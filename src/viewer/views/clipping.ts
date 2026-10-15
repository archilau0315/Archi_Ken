// 剖切控制（M10）：基于 renderer.clippingPlanes 的三轴向剖切平面。
// 每轴至多一个激活平面；未激活的平面直接移出数组（而非调大常量，避免 shader 边界问题）。

import * as THREE from 'three'

export type ClipAxis = 'x' | 'y' | 'z'
export type ClipSide = 'plus' | 'minus'

export interface ClipRange {
  min: THREE.Vector3
  max: THREE.Vector3
}

interface ActivePlane {
  plane: THREE.Plane
  axis: ClipAxis
  side: ClipSide
  position: number
}

const AXIS_INDEX: Record<ClipAxis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 }

export class ClippingController {
  private readonly renderer: THREE.WebGLRenderer
  private rangeProvider: (() => THREE.Box3 | null) | null = null
  private readonly actives = new Map<ClipAxis, ActivePlane>()

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

  /**
   * 设置某轴剖切平面。
   * side=plus：从正轴端切（保留负侧）；side=minus：从负轴端切（保留正侧）。
   */
  setClip(axis: ClipAxis, enabled: boolean, side: ClipSide = 'plus', position?: number): void {
    if (!enabled) {
      this.actives.delete(axis)
    } else {
      const range = this.getRange()
      if (!range) return
      const index = AXIS_INDEX[axis]
      const pos = position ?? (range.min.getComponent(index) + range.max.getComponent(index)) / 2
      const normal = new THREE.Vector3()
      normal.setComponent(index, side === 'plus' ? 1 : -1)
      // 平面方程 normal·p + constant = 0；丢弃 > 0 的片元
      const constant = side === 'plus' ? -pos : pos
      const existing = this.actives.get(axis)
      if (existing) {
        existing.plane.normal.copy(normal)
        existing.plane.constant = constant
        existing.side = side
        existing.position = pos
      } else {
        this.actives.set(axis, { plane: new THREE.Plane(normal, constant), axis, side, position: pos })
      }
    }
    this.renderer.clippingPlanes = [...this.actives.values()].map((item) => item.plane)
  }

  /** 读取某轴当前切面状态（供 UI 滑杆回显）。 */
  getState(axis: ClipAxis): { side: ClipSide; position: number } | null {
    const active = this.actives.get(axis)
    return active ? { side: active.side, position: active.position } : null
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
