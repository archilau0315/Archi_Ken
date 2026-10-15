// 3D 视图组件（L4）：承载 WebGL 画布，随构件包围盒重建模型图层，处理点击拾取。
// M10：集成剖切、2D / 标准视角、3D 标记与演示视角能力，经 ViewerHandle 对外暴露。

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

import * as THREE from 'three'
import type { BboxItem, ElementMesh } from '../services/kernel'
import { buildMeshLayer, buildModelLayer, DEFAULT_SHELL_OPACITY, type ColorMode, type ModelLayer } from './model'
import { ViewerCore } from './scene'
import { ClippingController, type ClipAxis, type ClipSide } from './views/clipping'
import { MarkerLayer, type MarkerSpec } from './views/markers'
import type { PresetName, ViewMode, ViewState } from './views/viewpoints'

export interface ViewerProps {
  items: BboxItem[] | ElementMesh[]
  selectedGuid: string | null
  onSelect: (guid: string | null) => void
  onMarkerPick?: (markerId: string | null) => void
  /** 为 true 时按三角网格构建真实模型；缺省按包围盒降级。 */
  useMesh?: boolean
  /** 显色模式：真实网格模式下可选专业配色或 IFC 原生颜色；包围盒模式恒按专业配色。 */
  colorMode?: ColorMode
}

export interface ClipRangeDTO {
  min: [number, number, number]
  max: [number, number, number]
}

/** 单轴剖切状态（供 UI 回显，含拖拽产生的变更）。 */
export interface ClipStateDTO {
  axis: ClipAxis
  side: ClipSide
  position: number
}

/** 对外暴露的能力（快照、剖切、视角、标记，供各功能面板调用）。 */
export interface ViewerHandle {
  capture: () => string | null
  setViewMode: (mode: ViewMode) => void
  getViewMode: () => ViewMode
  applyPreset: (preset: PresetName) => void
  getViewState: () => ViewState
  flyToState: (state: ViewState, duration?: number) => void
  getClipRange: () => ClipRangeDTO | null
  setClip: (axis: ClipAxis, enabled: boolean, side?: ClipSide, position?: number) => void
  clearClip: () => void
  /** 读取全部启用中的剖切轴状态。 */
  getClipStates: () => ClipStateDTO[]
  /** 订阅剖切状态变化，返回取消订阅函数。 */
  onClipChange: (listener: (states: ClipStateDTO[]) => void) => () => void
  /** 开启 / 关闭剖切面拖拽（传轴开启，传 null 关闭）；开启时该轴未剖切则自动启用。 */
  setSectionDrag: (axis: ClipAxis | null) => void
  /** 开关「淡化外壳」：建筑 / 结构 / 场地转半透明（opacity 可调 0.05~0.9），露出内部机电管线。 */
  setShellFade: (on: boolean, opacity?: number) => void
  addMarker: (spec: MarkerSpec) => void
  removeMarker: (id: string) => void
  clearMarkers: () => void
  focusMarker: (id: string) => void
  focusPosition: (position: [number, number, number]) => void
  getElementCenter: (guid: string) => [number, number, number] | null
}

const Viewer = forwardRef<ViewerHandle, ViewerProps>(function Viewer(
  { items, selectedGuid, onSelect, onMarkerPick, useMesh = false, colorMode = 'discipline' },
  ref
) {
  const hostRef = useRef<HTMLDivElement>(null)
  const coreRef = useRef<ViewerCore | null>(null)
  const layerRef = useRef<ModelLayer | null>(null)
  const clipRef = useRef<ClippingController | null>(null)
  const markerRef = useRef<MarkerLayer | null>(null)
  const shellFadeRef = useRef({ on: false, opacity: DEFAULT_SHELL_OPACITY })
  const clipListeners = useRef<Set<(states: ClipStateDTO[]) => void>>(new Set())
  const onSelectRef = useRef(onSelect)
  const onMarkerPickRef = useRef(onMarkerPick)
  onSelectRef.current = onSelect
  onMarkerPickRef.current = onMarkerPick

  /** 读取全部启用中的剖切轴状态（含拖拽产生的变更）。 */
  function readClipStates(): ClipStateDTO[] {
    const clip = clipRef.current
    if (!clip) return []
    const states: ClipStateDTO[] = []
    for (const axis of ['x', 'y', 'z'] as ClipAxis[]) {
      const state = clip.getState(axis)
      if (state) states.push({ axis, side: state.side, position: state.position })
    }
    return states
  }

  function emitClipChange(): void {
    const states = readClipStates()
    for (const listener of clipListeners.current) listener(states)
  }

  useImperativeHandle(
    ref,
    () => ({
      capture: () => coreRef.current?.capture() ?? null,
      setViewMode: (mode) => coreRef.current?.setMode(mode),
      getViewMode: () => coreRef.current?.viewMode ?? 'perspective',
      applyPreset: (preset) => coreRef.current?.applyPreset(preset),
      getViewState: () => {
        const core = coreRef.current
        if (core) return core.getViewState()
        return {
          mode: 'perspective',
          position: [0, 0, 0],
          target: [0, 0, 0],
          up: [0, 0, 1],
          zoom: 1
        }
      },
      flyToState: (state, duration) => coreRef.current?.flyToState(state, duration),
      getClipRange: () => {
        const range = clipRef.current?.getRange()
        if (!range) return null
        return {
          min: [range.min.x, range.min.y, range.min.z],
          max: [range.max.x, range.max.y, range.max.z]
        }
      },
      setClip: (axis, enabled, side, position) => {
        clipRef.current?.setClip(axis, enabled, side, position)
        emitClipChange()
      },
      clearClip: () => {
        clipRef.current?.clear()
        emitClipChange()
      },
      getClipStates: () => readClipStates(),
      onClipChange: (listener) => {
        clipListeners.current.add(listener)
        return () => {
          clipListeners.current.delete(listener)
        }
      },
      setSectionDrag: (axis) => {
        const clip = clipRef.current
        // 未启用该轴时一键启用：从 + 端切、位置默认取范围中点。
        if (axis && clip && !clip.getState(axis)) clip.setClip(axis, true, 'plus')
        coreRef.current?.setSectionAxis(axis, axis ? clip?.getState(axis)?.position ?? null : null)
        emitClipChange()
      },
      setShellFade: (on, opacity = DEFAULT_SHELL_OPACITY) => {
        shellFadeRef.current = { on, opacity }
        layerRef.current?.setShellFade(on, opacity)
      },
      addMarker: (spec) => markerRef.current?.add(spec),
      removeMarker: (id) => markerRef.current?.remove(id),
      clearMarkers: () => markerRef.current?.clear(),
      focusMarker: (id) => {
        const core = coreRef.current
        const position = markerRef.current?.positionOf(id)
        if (core && position) core.flyTo(position, core.fitRadiusValue * 0.8)
      },
      focusPosition: (position) => {
        const core = coreRef.current
        core?.flyTo(new THREE.Vector3(position[0], position[1], position[2]), core.fitRadiusValue * 0.8)
      },
      getElementCenter: (guid) => {
        const layer = layerRef.current
        if (!layer) return null
        return layer.centerOf(guid)
      }
    }),
    []
  )

  // 初始化 three.js 视图（仅一次）。
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const core = new ViewerCore(host)
    core.onPick((guid) => onSelectRef.current(guid))
    core.onMarkerPick((markerId) => onMarkerPickRef.current?.(markerId))

    const clipping = new ClippingController(core.renderer)
    const markers = new MarkerLayer()
    core.scene.add(markers.group)
    core.setMarkerTargets(markers.pickObjects)

    // 剖切拖拽：范围取自当前图层包围盒，拖拽结果直接写入剖切控制器并回传 UI。
    core.setSectionRangeProvider(() => {
      const range = clipping.getRange()
      if (!range) return null
      return {
        min: [range.min.x, range.min.y, range.min.z],
        max: [range.max.x, range.max.y, range.max.z]
      }
    })
    core.onSectionDrag((axis, position) => {
      const side = clipping.getState(axis)?.side ?? 'plus'
      clipping.setClip(axis, true, side, position)
      emitClipChange()
    })

    coreRef.current = core
    clipRef.current = clipping
    markerRef.current = markers
    return () => {
      core.setSectionRangeProvider(null)
      clipping.dispose()
      markers.dispose()
      core.scene.remove(markers.group)
      core.dispose()
      coreRef.current = null
      clipRef.current = null
      markerRef.current = null
      layerRef.current = null
    }
  }, [])

  // 构件列表 / 显色模式变化时重建模型图层（useMesh 决定真实网格或包围盒降级）。
  useEffect(() => {
    const core = coreRef.current
    if (!core) return
    layerRef.current?.dispose()
    const layer = useMesh
      ? buildMeshLayer(items as ElementMesh[], colorMode)
      : buildModelLayer(items as BboxItem[])
    core.scene.add(layer.group)
    core.setPickTargets(layer.meshes)
    core.frameObject(layer.group)
    // 剖切范围跟随当前图层：建模后缓存一次包围盒（图层几何固定不变），
    // 拖拽 / 滑杆 / 订阅回显高频取范围时不再全场景遍历。
    const clipBox = new THREE.Box3().setFromObject(layer.group)
    clipRef.current?.setRangeProvider(() => clipBox.clone())
    markerRef.current?.setWorldScale(Math.max(core.fitRadiusValue / 22, 0.3))
    // 换模型 / 切换显示模式后，按当前开关与透明度回填淡化效果。
    layer.setShellFade(shellFadeRef.current.on, shellFadeRef.current.opacity)
    layerRef.current = layer
    // 旧模型的剖切坐标对新模型已失效：清空剖切并通知订阅方重取范围与轴状态。
    clipRef.current?.clear()
    emitClipChange()
    return () => {
      clipRef.current?.setRangeProvider(null)
      core.scene.remove(layer.group)
      layer.dispose()
      if (layerRef.current === layer) layerRef.current = null
    }
  }, [items, useMesh, colorMode])

  // 选中构件高亮。
  useEffect(() => {
    layerRef.current?.setSelected(selectedGuid)
  }, [selectedGuid, items])

  return <div className="viewer-canvas" ref={hostRef} />
})

export default Viewer
