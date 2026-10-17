// 剖切控制（M10）：基于 renderer.clippingPlanes 的三轴向剖切平面。
// 手动剖切每轴至多一个平面；楼层区间剖切同轴可挂上下两个面（键为 'axis:side'）。
// 未激活的平面直接移出数组（而非调大常量，避免 shader 边界问题）。

import * as THREE from 'three'

export type ClipAxis = 'x' | 'y' | 'z'
export type ClipSide = 'plus' | 'minus'

export interface ClipRange {
  min: THREE.Vector3
  max: THREE.Vector3
}

/** 楼层标高区间：仅保留 [min, max] 内的几何；max 为 null 时上不封顶。 */
export interface ClipElevationRange {
  min: number
  max: number | null
}

/** 剖切来源：manual = 工具条单面剖切；range = 楼层区间剖切。 */
type ClipSource = 'manual' | 'range'

interface ActivePlane {
  plane: THREE.Plane
  axis: ClipAxis
  side: ClipSide
  position: number
  source: ClipSource
}

const AXIS_INDEX: Record<ClipAxis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 }

export class ClippingController {
  private readonly renderer: THREE.WebGLRenderer
  private rangeProvider: (() => THREE.Box3 | null) | null = null
  // 键为 'axis:side'：楼层区间剖切需要同轴上下两个面共存。
  private readonly actives = new Map<string, ActivePlane>()

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer
    this.renderer.localClippingEnabled = false
  }

  /** 设置模型包围盒提供者（图层重建后切换）。 */
  setRangeProvider(provider: (() => THREE.Box3 | null) | null): void {
    this.rangeProvider = provider
  }

  /** 当前模型包围盒（空场景返回 null）。 */
  getRange(): ClipRange | null {
    const box = this.rangeProvider?.()
    if (!box || box.isEmpty()) return null
    return { min: box.min.clone(), max: box.max.clone() }
  }

  private apply(): void {
    this.renderer.clippingPlanes = [...this.actives.values()].map((item) => item.plane)
  }

  private makePlane(axis: ClipAxis, side: ClipSide, pos: number): THREE.Plane {
    const index = AXIS_INDEX[axis]
    const normal = new THREE.Vector3()
    normal.setComponent(index, side === 'plus' ? 1 : -1)
    // 平面方程 normal·p + constant = 0；丢弃 > 0 的片元
    const constant = side === 'plus' ? -pos : pos
    return new THREE.Plane(normal, constant)
  }

  /** 清空某轴全部分面（手动 + 区间）：任一方操作即接管该轴。 */
  private clearAxis(axis: ClipAxis): void {
    this.actives.delete(`${axis}:plus`)
    this.actives.delete(`${axis}:minus`)
  }

  /**
   * 设置某轴剖切平面。
   * side=plus：从正轴端切（保留负侧）；side=minus：从负轴端切（保留正侧）。
   * 手动剖切接管该轴：连同楼层区间剖切一起替换。
   */
  setClip(axis: ClipAxis, enabled: boolean, side: ClipSide = 'plus', position?: number): void {
    this.clearAxis(axis)
    if (enabled) {
      const range = this.getRange()
      if (!range) return
      const index = AXIS_INDEX[axis]
      const pos = position ?? (range.min.getComponent(index) + range.max.getComponent(index)) / 2
      this.actives.set(`${axis}:${side}`, {
        plane: this.makePlane(axis, side, pos),
        axis,
        side,
        position: pos,
        source: 'manual'
      })
    }
    this.apply()
  }

  /** 楼层区间剖切：同轴挂 minus（保留下限以上）与 plus（保留上限以下）两个面。传 null 清除该轴剖切。 */
  setClipRange(axis: ClipAxis, range: ClipElevationRange | null): void {
    this.clearAxis(axis)
    if (range) {
      this.actives.set(`${axis}:minus`, {
        plane: this.makePlane(axis, 'minus', range.min),
        axis,
        side: 'minus',
        position: range.min,
        source: 'range'
      })
      if (range.max !== null) {
        this.actives.set(`${axis}:plus`, {
          plane: this.makePlane(axis, 'plus', range.max),
          axis,
          side: 'plus',
          position: range.max,
          source: 'range'
        })
      }
    }
    this.apply()
  }

  /** 读取某轴当前手动切面状态（供 UI 滑杆回显）；区间剖切不占用滑杆，返回 null。 */
  getState(axis: ClipAxis): { side: ClipSide; position: number } | null {
    const active = this.actives.get(`${axis}:plus`) ?? this.actives.get(`${axis}:minus`)
    return active && active.source === 'manual' ? { side: active.side, position: active.position } : null
  }

  clear(): void {
    this.actives.clear()
    this.renderer.clippingPlanes = []
  }

  dispose(): void {
    this.clear()
    this.rangeProvider = null
  }
}
