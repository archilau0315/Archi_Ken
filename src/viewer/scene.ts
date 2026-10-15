// 3D 视图核心（L4）：three.js 场景、相机、渲染循环与构件拾取。
// 只负责「显示与交互」，不感知业务数据结构（模型图层由 model.ts 组装）。
// M10：Z-up 轨道、透视/正交双相机、标准视角预设、相机飞行、标记拾取。

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import { presetPlacement, type PresetName, type ViewMode, type ViewState } from './views/viewpoints'
import type { ClipAxis } from './views/clipping'

export type PickHandler = (guid: string | null) => void
export type MarkerPickHandler = (markerId: string | null) => void
/** 剖切范围提供者：返回各轴最小 / 最大坐标（模型包围盒变化后刷新）。 */
export type SectionRange = { min: [number, number, number]; max: [number, number, number] }
/** 剖切面拖拽回调：axis 为被拖轴，position 为换算后的切面坐标。 */
export type SectionDragHandler = (axis: ClipAxis, position: number) => void

/** 从被拾取对象向上找到带 guid 的构件对象。 */
function findGuid(object: THREE.Object3D | null): string | null {
  let current: THREE.Object3D | null = object
  while (current) {
    const guid = current.userData?.guid
    if (typeof guid === 'string') return guid
    current = current.parent
  }
  return null
}

function findMarkerId(object: THREE.Object3D | null): string | null {
  let current: THREE.Object3D | null = object
  while (current) {
    const markerId = current.userData?.markerId
    if (typeof markerId === 'string') return markerId
    current = current.parent
  }
  return null
}

function easeInOutCubic(k: number): number {
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
}

interface CameraTween {
  startedAt: number
  duration: number
  fromPosition: THREE.Vector3
  toPosition: THREE.Vector3
  fromTarget: THREE.Vector3
  toTarget: THREE.Vector3
  fromUp: THREE.Vector3
  toUp: THREE.Vector3
  fromZoom: number
  toZoom: number
}

export class ViewerCore {
  readonly scene: THREE.Scene
  readonly renderer: THREE.WebGLRenderer

  private readonly container: HTMLElement
  private readonly observer: ResizeObserver
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private readonly handlers: PickHandler[] = []
  private readonly markerHandlers: MarkerPickHandler[] = []
  private perspectiveCamera: THREE.PerspectiveCamera
  private orthoCamera: THREE.OrthographicCamera
  private mode: ViewMode = 'perspective'
  private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
  controls: OrbitControls
  private targets: THREE.Object3D[] = []
  private markerTargets: THREE.Object3D[] = []
  private downAt: { x: number; y: number } | null = null
  private frameId = 0
  private tween: CameraTween | null = null
  /** 最近一次取景的中心与半径（预设视角与正交投影共用）。 */
  private fitCenter = new THREE.Vector3()
  private fitRadius = 10
  private controlsTarget = new THREE.Vector3()
  /** 剖切拖拽：锁定的轴、起始坐标、范围提供者与订阅。 */
  private sectionAxis: ClipAxis | null = null
  private sectionStart: number | null = null
  private sectionRange: (() => SectionRange | null) | null = null
  private readonly sectionHandlers: SectionDragHandler[] = []
  private dragging: {
    startX: number
    startY: number
    index: 0 | 1 | 2
    startPos: number
    min: number
    max: number
  } | null = null

  constructor(container: HTMLElement) {
    this.container = container
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0xeef1f5)

    this.perspectiveCamera = new THREE.PerspectiveCamera(50, 1, 0.05, 5000)
    this.perspectiveCamera.up.set(0, 0, 1)
    this.perspectiveCamera.position.set(14, 12, 12)

    this.orthoCamera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.05, 5000)
    this.orthoCamera.up.set(0, 0, 1)
    this.orthoCamera.position.set(14, 12, 12)

    this.camera = this.perspectiveCamera

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(this.renderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.85))
    const sun = new THREE.DirectionalLight(0xffffff, 1.1)
    sun.position.set(8, 10, 14)
    this.scene.add(sun)
    const fill = new THREE.DirectionalLight(0xffffff, 0.35)
    fill.position.set(-10, -8, 6)
    this.scene.add(fill)

    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(container)
    this.resize()

    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown)
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove)
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp)
    this.animate()
  }

  /** 当前活动相机（透视或正交）。 */
  get activeCamera(): THREE.Camera {
    return this.camera
  }

  get viewMode(): ViewMode {
    return this.mode
  }

  /** 最近一次取景半径（供标记尺度、飞行距离参考）。 */
  get fitRadiusValue(): number {
    return this.fitRadius
  }

  /** 订阅构件拾取事件（点击模型空白处回调 null）。 */
  onPick(handler: PickHandler): void {
    this.handlers.push(handler)
  }

  /** 订阅标记拾取事件（优先于构件拾取）。 */
  onMarkerPick(handler: MarkerPickHandler): void {
    this.markerHandlers.push(handler)
  }

  /** 设置可被射线拾取的构件对象集合。 */
  setPickTargets(objects: THREE.Object3D[]): void {
    this.targets = objects
  }

  /** 设置可被射线拾取的标记对象集合（M10）。 */
  setMarkerTargets(objects: THREE.Object3D[]): void {
    this.markerTargets = objects
  }

  /** 订阅剖切面拖拽（实时回传轴与新位置）。 */
  onSectionDrag(handler: SectionDragHandler): void {
    this.sectionHandlers.push(handler)
  }

  /** 设置剖切范围提供者（图层重建后刷新）。 */
  setSectionRangeProvider(provider: (() => SectionRange | null) | null): void {
    this.sectionRange = provider
  }

  /**
   * 锁定 / 解锁剖切拖拽轴。
   * 传入轴后，画布左键拖动即沿该轴平移切面（暂停轨道旋转，保留缩放与平移）。
   */
  setSectionAxis(axis: ClipAxis | null, position: number | null = null): void {
    this.sectionAxis = axis
    this.sectionStart = position
    this.dragging = null
    this.controls.enableRotate = !axis
  }

  /** 相机自动取景到指定对象的包围盒。 */
  frameObject(object: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(object)
    if (box.isEmpty()) return
    const size = box.getSize(new THREE.Vector3())
    this.fitCenter = box.getCenter(new THREE.Vector3())
    this.fitRadius = Math.max(size.length() * 0.5, 1)
    this.placeCamera('iso')
    this.camera.near = Math.max(this.fitRadius / 100, 0.01)
    this.camera.far = this.fitRadius * 80
    this.camera.updateProjectionMatrix()
    this.controls.update()
  }

  /** 按标准视角预设摆放相机（沿用上一次取景的中心与半径）。 */
  applyPreset(preset: PresetName): void {
    this.placeCamera(preset)
    this.controls.update()
  }

  private placeCamera(preset: PresetName): void {
    const distance = this.mode === 'orthographic' ? this.fitRadius * 1.6 : this.perspectiveDistance()
    const { position, up } = presetPlacement(preset, this.fitCenter, distance)
    this.camera.position.copy(position)
    this.camera.up.copy(up)
    this.controls.target.copy(this.fitCenter)
    if (this.mode === 'orthographic') this.updateOrthoFrustum()
  }

  private perspectiveDistance(): number {
    return (this.fitRadius / Math.tan((this.perspectiveCamera.fov * Math.PI) / 360)) * 1.4
  }

  /** 切换透视 / 正交模式，保持当前视角姿态。 */
  setMode(mode: ViewMode): void {
    if (mode === this.mode) return
    const old = this.camera
    const next = mode === 'orthographic' ? this.orthoCamera : this.perspectiveCamera
    next.position.copy(old.position)
    next.up.copy(old.up)
    next.near = old.near
    next.far = old.far
    next.updateProjectionMatrix()
    if (mode === 'orthographic') {
      this.orthoCamera.zoom = 1
      this.updateOrthoFrustum()
    }
    this.camera = next
    this.mode = mode

    this.controls.dispose()
    this.controls = new OrbitControls(next, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.enableRotate = !this.sectionAxis
    this.controls.target.copy(this.controlsTarget)
    this.controls.update()
  }

  /** 依据取景半径与画布宽高比更新正交投影范围。 */
  private updateOrthoFrustum(): void {
    const aspect = this.container.clientWidth / Math.max(this.container.clientHeight, 1)
    const half = this.fitRadius * 1.2
    this.orthoCamera.left = -half * aspect
    this.orthoCamera.right = half * aspect
    this.orthoCamera.top = half
    this.orthoCamera.bottom = -half
    this.orthoCamera.updateProjectionMatrix()
  }

  /** 读取当前相机状态（用于保存演示视角）。 */
  getViewState(): ViewState {
    return {
      mode: this.mode,
      position: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
      target: [this.controls.target.x, this.controls.target.y, this.controls.target.z],
      up: [this.camera.up.x, this.camera.up.y, this.camera.up.z],
      zoom: this.mode === 'orthographic' ? this.orthoCamera.zoom : 1
    }
  }

  /** 飞行到指定相机状态（需要时先切换模式；正交 zoom 一并过渡）。 */
  flyToState(state: ViewState, duration = 900): void {
    this.setMode(state.mode)
    this.tween = {
      startedAt: performance.now(),
      duration: Math.max(duration, 1),
      fromPosition: this.camera.position.clone(),
      toPosition: new THREE.Vector3(...state.position),
      fromTarget: this.controls.target.clone(),
      toTarget: new THREE.Vector3(...state.target),
      fromUp: this.camera.up.clone(),
      toUp: new THREE.Vector3(...state.up).normalize(),
      fromZoom: this.mode === 'orthographic' ? this.orthoCamera.zoom : 1,
      toZoom: state.zoom
    }
    this.controls.enabled = false
  }

  /** 飞行到指定关注点（构件 / 标记定位），视角方向保持当前。 */
  flyTo(target: THREE.Vector3, distance: number, duration = 700): void {
    const direction = this.camera.position.clone().sub(this.controls.target).normalize()
    this.tween = {
      startedAt: performance.now(),
      duration: Math.max(duration, 1),
      fromPosition: this.camera.position.clone(),
      toPosition: target.clone().addScaledVector(direction, distance),
      fromTarget: this.controls.target.clone(),
      toTarget: target.clone(),
      fromUp: this.camera.up.clone(),
      toUp: this.camera.up.clone(),
      fromZoom: this.mode === 'orthographic' ? this.orthoCamera.zoom : 1,
      toZoom: this.mode === 'orthographic' ? this.orthoCamera.zoom : 1
    }
    this.controls.enabled = false
  }

  private applyTween(now: number): void {
    const tween = this.tween
    if (!tween) return
    const k = Math.min(1, (now - tween.startedAt) / tween.duration)
    const eased = easeInOutCubic(k)
    this.camera.position.lerpVectors(tween.fromPosition, tween.toPosition, eased)
    this.controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased)
    this.camera.up.lerpVectors(tween.fromUp, tween.toUp, eased).normalize()
    if (this.mode === 'orthographic') {
      this.orthoCamera.zoom = THREE.MathUtils.lerp(tween.fromZoom, tween.toZoom, eased)
      this.orthoCamera.updateProjectionMatrix()
    }
    if (k >= 1) {
      this.tween = null
      this.controls.enabled = true
    }
  }

  private resize(): void {
    const width = this.container.clientWidth || 1
    const height = this.container.clientHeight || 1
    this.renderer.setSize(width, height, false)
    this.perspectiveCamera.aspect = width / height
    this.perspectiveCamera.updateProjectionMatrix()
    this.updateOrthoFrustum()
  }

  private onPointerDown = (event: PointerEvent): void => {
    this.downAt = { x: event.clientX, y: event.clientY }
    const primaryDown = event.button === 0 || (event.buttons & 1) === 1
    if (this.sectionAxis && primaryDown) this.beginSectionDrag(event)
  }

  /**
   * 拖拽剖切面：指针位移沿该轴在屏幕上的方向投影，换算为世界坐标并实时回传。
   * 轴投影退化（如顶视下的 Z 轴）时退回水平映射，保证任何视角都能拖。
   */
  private onPointerMove = (event: PointerEvent): void => {
    const drag = this.dragging
    const axis = this.sectionAxis
    if (!drag || !axis) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    const screen = this.sectionScreenAxis(drag.index)
    const along = screen ? dx * screen.dirX + dy * screen.dirY : dx
    const rect = this.renderer.domElement.getBoundingClientRect()
    const fallbackPerUnit = (rect.width || 1) / Math.max(drag.max - drag.min, 1e-6)
    const pxPerUnit = screen && screen.pxPerUnit > 1e-3 ? screen.pxPerUnit : fallbackPerUnit
    const next = THREE.MathUtils.clamp(drag.startPos + along / pxPerUnit, drag.min, drag.max)
    for (const handler of this.sectionHandlers) handler(axis, next)
  }

  /** 记录拖拽起点与范围；起点取当前切面坐标（缺省取范围中点）。 */
  private beginSectionDrag(event: PointerEvent): void {
    const axis = this.sectionAxis
    const range = this.sectionRange?.()
    if (!axis || !range) return
    const index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2
    const min = range.min[index]
    const max = range.max[index]
    const raw = this.sectionStart ?? (min + max) / 2
    this.dragging = {
      startX: event.clientX,
      startY: event.clientY,
      index,
      startPos: THREE.MathUtils.clamp(raw, min, max),
      min,
      max
    }
  }

  /** 当前相机下把某世界轴投影成屏幕方向（像素/单位），供拖拽换算。 */
  private sectionScreenAxis(index: 0 | 1 | 2): { dirX: number; dirY: number; pxPerUnit: number } | null {
    const rect = this.renderer.domElement.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    const origin = this.controls.target.clone()
    const tip = origin.clone()
    tip.setComponent(index, tip.getComponent(index) + 1)
    const a = origin.clone().project(this.camera)
    const b = tip.clone().project(this.camera)
    const dx = ((b.x - a.x) * rect.width) / 2
    const dy = (-(b.y - a.y) * rect.height) / 2
    const pxPerUnit = Math.hypot(dx, dy)
    if (pxPerUnit < 1e-6) return null
    return { dirX: dx / pxPerUnit, dirY: dy / pxPerUnit, pxPerUnit }
  }

  private onPointerUp = (event: PointerEvent): void => {
    const down = this.downAt
    this.downAt = null
    const wasDragging = this.dragging !== null
    this.dragging = null
    // 拖动旋转视角 / 拖动剖切面时不触发拾取
    if (wasDragging || !down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 4) return

    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)

    if (this.markerTargets.length) {
      const markerHits = this.raycaster.intersectObjects(this.markerTargets, false)
      const markerId = markerHits.length ? findMarkerId(markerHits[0].object) : null
      if (markerId) {
        for (const handler of this.markerHandlers) handler(markerId)
        return
      }
    }
    const hits = this.raycaster.intersectObjects(this.targets, false)
    const guid = hits.length ? findGuid(hits[0].object) : null
    for (const handler of this.handlers) handler(guid)
  }

  private animate = (): void => {
    this.frameId = requestAnimationFrame(this.animate)
    const now = performance.now()
    this.applyTween(now)
    this.controlsTarget.copy(this.controls.target)
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  /** 截取当前视图为 PNG dataURL（沟通问题快照用）。 */
  capture(): string | null {
    try {
      this.renderer.render(this.scene, this.camera)
      return this.renderer.domElement.toDataURL('image/png')
    } catch {
      return null
    }
  }

  /** 释放全部资源（卸载组件时调用）。 */
  dispose(): void {
    cancelAnimationFrame(this.frameId)
    this.observer.disconnect()
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown)
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove)
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp)
    this.controls.dispose()
    this.renderer.dispose()
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement)
    }
  }
}
