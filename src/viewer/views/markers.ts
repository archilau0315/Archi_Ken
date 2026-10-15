// 3D 标记图层（M10）：在问题位置 / 构件位置放置图钉（球体 + 文字标签）。
// 球体与标签都带 userData.markerId，供场景射线拾取后回调。

import * as THREE from 'three'

export interface MarkerSpec {
  id: string
  label: string
  position: readonly [number, number, number]
  /** 十六进制颜色；默认紫色（手动标记）。 */
  color?: string
  /** 关联构件 guid（点击标记时供外部联动选中）。 */
  guid?: string
}

export interface MarkerEntry extends MarkerSpec {}

const RADIUS = 0.5
const COLOR_DEFAULT = '#7c3aed'

/** 生成圆形小标签（canvas → Sprite，始终面向相机）。 */
function makeLabelSprite(text: string, color: string, scale: number): THREE.Sprite {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建 2D 画布上下文')
  const font = '14px "Microsoft YaHei", "Segoe UI", sans-serif'
  ctx.font = font
  const width = Math.ceil(ctx.measureText(text).width) + 20
  const height = 26
  canvas.width = width * 2
  canvas.height = height * 2
  ctx.scale(2, 2)
  ctx.font = font
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.beginPath()
  ctx.roundRect(0, 0, width, height, 8)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = '#1f2937'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 10, height / 2 + 1)

  const texture = new THREE.CanvasTexture(canvas)
  texture.anisotropy = 4
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set((width / height) * scale, scale, 1)
  return sprite
}

export class MarkerLayer {
  readonly group = new THREE.Group()
  /** 可被拾取的对象（球体 + 标签）。 */
  readonly pickObjects: THREE.Object3D[] = []
  private readonly sphereGeometry = new THREE.SphereGeometry(RADIUS, 20, 14)
  private readonly materials = new Map<string, THREE.MeshBasicMaterial>()
  private readonly entries = new Map<string, { mesh: THREE.Mesh; sprite: THREE.Sprite; spec: MarkerSpec }>()
  private labelScale = 1.2

  /** 按模型尺寸设定标签世界尺寸。 */
  setWorldScale(scale: number): void {
    this.labelScale = scale
    for (const { sprite } of this.entries.values()) {
      const ratio = sprite.scale.x / (sprite.scale.y || 1)
      sprite.scale.set(ratio * scale, scale, 1)
    }
  }

  add(spec: MarkerSpec): void {
    if (this.entries.has(spec.id)) this.remove(spec.id)
    const color = spec.color ?? COLOR_DEFAULT
    let material = this.materials.get(color)
    if (!material) {
      material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), depthTest: true })
      this.materials.set(color, material)
    }
    const mesh = new THREE.Mesh(this.sphereGeometry, material)
    mesh.position.set(spec.position[0], spec.position[1], spec.position[2])
    mesh.userData.markerId = spec.id
    mesh.renderOrder = 10

    const sprite = makeLabelSprite(spec.label, color, this.labelScale)
    sprite.position.set(spec.position[0], spec.position[1] + RADIUS * 2.2, spec.position[2])
    sprite.userData.markerId = spec.id
    sprite.renderOrder = 11

    this.group.add(mesh, sprite)
    this.pickObjects.push(mesh, sprite)
    this.entries.set(spec.id, { mesh, sprite, spec })
  }

  remove(id: string): void {
    const entry = this.entries.get(id)
    if (!entry) return
    this.group.remove(entry.mesh, entry.sprite)
    this.pickObjects.splice(
      0,
      this.pickObjects.length,
      ...this.pickObjects.filter((obj) => obj !== entry.mesh && obj !== entry.sprite)
    )
    entry.sprite.material.map?.dispose()
    entry.sprite.material.dispose()
    this.entries.delete(id)
  }

  get(id: string): MarkerEntry | null {
    return this.entries.get(id)?.spec ?? null
  }

  list(): MarkerEntry[] {
    return [...this.entries.values()].map((item) => item.spec)
  }

  positionOf(id: string): THREE.Vector3 | null {
    const entry = this.entries.get(id)
    return entry ? entry.mesh.position.clone() : null
  }

  clear(): void {
    for (const id of [...this.entries.keys()]) this.remove(id)
  }

  dispose(): void {
    this.clear()
    this.sphereGeometry.dispose()
    for (const material of this.materials.values()) material.dispose()
    this.materials.clear()
    this.group.clear()
  }
}
