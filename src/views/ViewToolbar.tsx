// 3D 视图顶部紧凑工具条（L4，M10）：承载高频操作——视角切换与剖切。
// 工具条占据布局高度而非浮在画布上，因此不会遮挡模型；剖切直达 clippingPlanes，无「应用 / 保存」中间步骤。

import { useEffect, useState, type RefObject } from 'react'

import { useT } from '../i18n'
import type { ViewerHandle } from '../viewer/Viewer'
import { DEFAULT_SHELL_OPACITY } from '../viewer/model'
import type { ClipAxis, ClipSide } from '../viewer/views/clipping'
import type { PresetName, ViewMode } from '../viewer/views/viewpoints'

/** 单轴剖切 UI 状态。 */
export interface ClipAxisState {
  on: boolean
  side: ClipSide
  position: number
}

export const CLIP_AXES: ClipAxis[] = ['x', 'y', 'z']
const AXIS_INDEX: Record<ClipAxis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 }

export type ClipRangeValue = { min: [number, number, number]; max: [number, number, number] }

/** 某轴的范围中点（无范围时回退 0）。 */
export function axisMidPoint(range: ClipRangeValue | null, axis: ClipAxis): number {
  if (!range) return 0
  const index = AXIS_INDEX[axis]
  return (range.min[index] + range.max[index]) / 2
}

/** 新建一组默认（全部未启用）剖切状态。 */
export function makeClipStates(range: ClipRangeValue | null): Record<ClipAxis, ClipAxisState> {
  const result = {} as Record<ClipAxis, ClipAxisState>
  for (const axis of CLIP_AXES) {
    result[axis] = { on: false, side: 'plus', position: axisMidPoint(range, axis) }
  }
  return result
}

const PRESETS: PresetName[] = ['iso', 'top', 'front', 'back', 'left', 'right']

interface Props {
  viewerRef: RefObject<ViewerHandle>
}

export default function ViewToolbar({ viewerRef }: Props) {
  const { t } = useT()
  const [mode, setMode] = useState<ViewMode>(() => viewerRef.current?.getViewMode() ?? 'perspective')
  const [activePreset, setActivePreset] = useState<PresetName | null>('iso')
  const [clips, setClips] = useState<Record<ClipAxis, ClipAxisState>>(() => makeClipStates(null))
  const [range, setRange] = useState<ClipRangeValue | null>(null)
  const [selectedAxis, setSelectedAxis] = useState<ClipAxis | null>(null)
  const [faded, setFaded] = useState(false)
  const [fadeOpacity, setFadeOpacity] = useState(DEFAULT_SHELL_OPACITY)

  // 订阅剖切状态变化（含 3D 内拖拽与图层重建后的通知），范围与轴按钮 / 滑杆实时回显。
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    return viewer.onClipChange((states) => {
      setRange(viewer.getClipRange())
      setClips((prev) => {
        const next = { ...prev }
        for (const axis of CLIP_AXES) next[axis] = { ...next[axis], on: false }
        for (const state of states) next[state.axis] = { on: true, side: state.side, position: state.position }
        return next
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerRef])

  const enabledAxes = CLIP_AXES.filter((axis) => clips[axis].on)
  // 滑杆作用于「当前关注轴」：优先上次点击的轴，否则取第一个已启用轴。
  const sliderAxis: ClipAxis | null =
    selectedAxis !== null && enabledAxes.includes(selectedAxis) ? selectedAxis : enabledAxes[0] ?? null

  function changeMode(next: ViewMode): void {
    viewerRef.current?.setViewMode(next)
    setMode(next)
  }

  function applyPreset(preset: PresetName): void {
    // 顶 / 前 / 后 / 左右视角自动切正投影：正交相机正对轴线，看不到其它侧面；
    // 等轴测回透视。状态与相机模式保持同步。
    const nextMode: ViewMode = preset === 'iso' ? 'perspective' : 'orthographic'
    if (viewerRef.current?.getViewMode() !== nextMode) {
      viewerRef.current?.setViewMode(nextMode)
      setMode(nextMode)
    }
    viewerRef.current?.applyPreset(preset)
    setActivePreset(preset)
  }

  function toggleAxis(axis: ClipAxis, on: boolean): void {
    const viewer = viewerRef.current
    // 每次交互都重取范围，网格模式切换后滑杆区间自动跟上。
    const fresh = viewer?.getClipRange() ?? null
    setRange(fresh)
    setSelectedAxis(axis)
    const current = clips[axis]
    const position = current.on ? current.position : axisMidPoint(fresh, axis)
    viewer?.setClip(axis, on, current.side, on ? position : undefined)
  }

  function setAxisPosition(axis: ClipAxis, position: number): void {
    viewerRef.current?.setClip(axis, true, clips[axis].side, position)
  }

  function flipAxis(axis: ClipAxis): void {
    const nextSide: ClipSide = clips[axis].side === 'plus' ? 'minus' : 'plus'
    viewerRef.current?.setClip(axis, true, nextSide, clips[axis].position)
  }

  function toggleShellFade(): void {
    const next = !faded
    viewerRef.current?.setShellFade(next, fadeOpacity)
    setFaded(next)
  }

  function changeShellOpacity(value: number): void {
    setFadeOpacity(value)
    if (faded) viewerRef.current?.setShellFade(true, value)
  }

  const index = sliderAxis ? AXIS_INDEX[sliderAxis] : 0
  const min = range ? range.min[index] : 0
  const max = range ? range.max[index] : 1
  const step = max > min ? (max - min) / 200 : 0.01
  const position = sliderAxis ? clips[sliderAxis].position : 0

  return (
    <div className="view-toolbar" aria-label={t('views.toolbar')}>
      <div className="vt-group">
        <button
          className={faded ? 'view-active vt-btn' : 'ghost vt-btn'}
          onClick={toggleShellFade}
          title={t('views.shellFadeHint')}
        >
          {t('views.shellFade')}
        </button>
        {faded && (
          <>
            <input
              type="range"
              className="vt-slider vt-fade"
              min={0.05}
              max={0.9}
              step={0.01}
              value={fadeOpacity}
              title={t('views.shellFadeSlider', { pos: fadeOpacity.toFixed(2) })}
              onChange={(event) => changeShellOpacity(Number(event.target.value))}
            />
            <span className="vt-value">{Math.round(fadeOpacity * 100)}%</span>
          </>
        )}
        <button
          className={mode === 'perspective' ? 'view-active vt-btn' : 'ghost vt-btn'}
          onClick={() => changeMode('perspective')}
        >
          {t('views.perspective')}
        </button>
      </div>

      <span className="vt-sep" />

      <div className="vt-group">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            className={activePreset === preset ? 'view-active vt-btn' : 'ghost vt-btn'}
            onClick={() => applyPreset(preset)}
          >
            {t(`views.preset.${preset}`)}
          </button>
        ))}
      </div>

      <span className="vt-sep" />

      <div className="vt-group" title={t('views.clipHint')}>
        <strong className="vt-label">{t('views.sectionClip')}</strong>
        {CLIP_AXES.map((axis) => (
          <button
            key={axis}
            className={clips[axis].on ? 'view-active vt-axis' : 'ghost vt-axis'}
            onClick={() => toggleAxis(axis, !clips[axis].on)}
            title={`${t(`views.axis.${axis}`)} · ${t('views.clipEnableAxis')}`}
          >
            {axis.toUpperCase()}
          </button>
        ))}
        <input
          type="range"
          className="vt-slider"
          min={min}
          max={max}
          step={step}
          value={position}
          disabled={!sliderAxis}
          title={sliderAxis ? t('views.clipPosition', { pos: position.toFixed(2), min, max }) : t('views.clipOff')}
          onChange={(event) => sliderAxis && setAxisPosition(sliderAxis, Number(event.target.value))}
        />
        <span className="vt-value">{sliderAxis ? position.toFixed(2) : t('views.clipOff')}</span>
        <button
          className="ghost vt-btn"
          disabled={!sliderAxis}
          onClick={() => sliderAxis && flipAxis(sliderAxis)}
          title={t('views.clipFlip')}
        >
          {sliderAxis && clips[sliderAxis].side === 'minus' ? '−→+' : '+→−'}
        </button>
      </div>
    </div>
  )
}
