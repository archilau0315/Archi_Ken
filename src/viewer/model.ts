// 3D 模型图层（L4）：把内核返回的构件几何装配成 three.js 对象。
// 支持两种模式：真实三角网格（MeshBatchResponse.items）与包围盒降级（BboxItem）。
// 按 IFC 类型着色以区分专业构件；拾取对象与 guid 通过 userData 关联。

import * as THREE from 'three'

import type { BboxItem, ElementMesh } from '../services/kernel'

const PALETTE = [
  '#4f7cff', '#f2a154', '#5bbf8a', '#e26d6d', '#9b7ff2', '#c9b04a',
  '#43b0c9', '#d97ab0', '#7d8fa6', '#8bc34a', '#ff7043', '#26a69a'
]

const SELECT_COLOR = 0x1d4ed8

/** 常规不透明度（轻微半透明，保留一点层次感）。 */
const BASE_OPACITY = 0.92
/** 玻璃面组不透明度：半透明可看穿，框料保持常规实心。 */
export const GLASS_OPACITY = 0.35
/** 外壳淡化默认不透明度：既看穿又不完全消失（滑杆可调 0.05 ~ 0.9）。 */
export const DEFAULT_SHELL_OPACITY = 0.12
/** 外壳专业：淡化后即可看到内部的暖通 / 给排水 / 电气管线。 */
const SHELL_DISCIPLINES = new Set(['architecture', 'structural', 'site'])

/** 按 IFC 类型生成稳定的颜色（同类型同色）。 */
export function colorForType(ifcType: string): string {
  let hash = 0
  for (let i = 0; i < ifcType.length; i += 1) hash = (hash * 31 + ifcType.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

/** 显色模式：discipline=按专业配色；ifc=按 IFC 原生颜色（无样式构件回退类型色）。 */
export type ColorMode = 'discipline' | 'ifc'

/** 按显色模式取构件颜色：原始色模式用 ifc_color，专业色模式用融合给出的 color。 */
function modeColor(item: BboxItem, mode: ColorMode): string | undefined {
  return mode === 'ifc' ? item.ifc_color : item.color
}

/** 玻璃判定：IfcWindow / IfcDoor 以玻璃为主，或材质名含 glass / 玻璃 的面组按玻璃渲染（半透明），框料保持实心。 */
function isGlass(item: BboxItem): boolean {
  const type = item.ifc_type.toUpperCase()
  return type === 'IFCWINDOW' || type === 'IFCDOOR' || /glass|玻璃/i.test(item.material ?? '')
}

/** 材质按「玻璃 + 专业 + 颜色」缓存：玻璃与框料即使同色也必须分开建材质。 */
function materialKey(item: BboxItem, mode: ColorMode): string {
  const glass = isGlass(item) ? 'g' : 'o'
  return `${glass}|${item.discipline ?? ''}|${modeColor(item, mode) ?? item.ifc_type}`
}

/** 把材质登记到所属专业分组，供「淡化外壳」整组切换透明度。 */
function registerMaterial(
  byDiscipline: Map<string, Set<THREE.MeshStandardMaterial>>,
  discipline: string | undefined,
  material: THREE.MeshStandardMaterial
): void {
  if (!discipline) return
  let group = byDiscipline.get(discipline)
  if (!group) {
    group = new Set()
    byDiscipline.set(discipline, group)
  }
  group.add(material)
}

/** 生成「淡化外壳」开关：外壳专业转半透明并关闭深度写入，内部管线才不会被挡住。 */
function makeShellFade(
  byDiscipline: Map<string, Set<THREE.MeshStandardMaterial>>
): (on: boolean, opacity: number) => void {
  return (on, opacity) => {
    for (const [key, group] of byDiscipline) {
      const faded = on && SHELL_DISCIPLINES.has(key)
      for (const material of group) {
        const glass = material.userData.isGlass === true
        // 淡化时整组用外壳透明度；未淡化时玻璃保持玻璃透明度、深度写入保持关闭。
        material.opacity = faded ? opacity : glass ? GLASS_OPACITY : BASE_OPACITY
        material.depthWrite = faded ? false : !glass
      }
    }
  }
}

/** 多材质拆分的子网格 guid 形如 `<父 guid>#mN`：匹配父 guid 或其任一分片子网格。 */
function guidMatches(meshGuid: string, guid: string): boolean {
  return meshGuid === guid || meshGuid.startsWith(`${guid}#`)
}

/** 选中高亮框池：支持同时框选多个构件（如碰撞对 A/B）；拆分构件的多片子网格合并成一个框。 */
function makeSelection(group: THREE.Group, byGuid: Map<string, THREE.Mesh>, meshes: THREE.Mesh[]) {
  const helpers: THREE.Box3Helper[] = []
  const union = new THREE.Box3()
  return (guids: string[]): void => {
    while (helpers.length < guids.length) {
      const helper = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color(SELECT_COLOR))
      helper.visible = false
      group.add(helper)
      helpers.push(helper)
    }
    helpers.forEach((helper, i) => {
      const guid = i < guids.length ? guids[i] : null
      if (!guid) {
        helper.visible = false
        return
      }
      // 优先整构件；多材质拆分时父 guid 无独立网格，合并各分片子网格的包围盒。
      const direct = byGuid.get(guid)
      union.makeEmpty()
      if (direct) union.expandByObject(direct)
      else for (const mesh of meshes) if (guidMatches(mesh.userData.guid as string, guid)) union.expandByObject(mesh)
      if (union.isEmpty()) {
        helper.visible = false
        return
      }
      helper.box.copy(union)
      helper.visible = true
    })
  }
}

/** 隔离显示：只保留指定构件（含其拆分子网格），其余隐藏；传 null 恢复全部。 */
function makeIsolate(meshes: THREE.Mesh[]) {
  return (guids: string[] | null): void => {
    if (!guids) {
      for (const mesh of meshes) mesh.visible = true
      return
    }
    for (const mesh of meshes) {
      const meshGuid = mesh.userData.guid as string
      mesh.visible = guids.some((guid) => guidMatches(meshGuid, guid))
    }
  }
}

export interface ModelLayer {
  group: THREE.Group
  /** 可被射线拾取的构件网格。 */
  meshes: THREE.Mesh[]
  setSelected(guid: string | null): void
  /** 同时框选多个构件（碰撞对定位用）；传空数组清除全部高亮框。 */
  setSelectedMany(guids: string[]): void
  /** 只显示指定构件（碰撞对隔离查看），其余隐藏；传 null 恢复全部显示。 */
  isolate(guids: string[] | null): void
  /** 开关「淡化外壳」：建筑 / 结构 / 场地转半透明（透明度可调），露出内部机电管线。 */
  setShellFade(on: boolean, opacity: number): void
  /** 构件包围盒中心（无该构件时返回 null，M10 标记定位用）。 */
  centerOf(guid: string): [number, number, number] | null
  dispose(): void
}

/** 用包围盒列表构建模型图层（降级模式）。 */
export function buildModelLayer(items: BboxItem[]): ModelLayer {
  const group = new THREE.Group()
  const meshes: THREE.Mesh[] = []
  const geometries: THREE.BufferGeometry[] = []
  const materials = new Map<string, THREE.MeshStandardMaterial>()
  const byDiscipline = new Map<string, Set<THREE.MeshStandardMaterial>>()
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.35 })
  const byGuid = new Map<string, THREE.Mesh>()

  for (const item of items) {
    const [dx, dy, dz] = item.size
    const geometry = new THREE.BoxGeometry(
      Math.max(dx, 1e-4),
      Math.max(dy, 1e-4),
      Math.max(dz, 1e-4)
    )
    // 融合模型按专业给色；单模型无显式颜色时按 IFC 类型着色（包围盒模式恒为专业配色）。
    const key = materialKey(item, 'discipline')
    let material = materials.get(key)
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(item.color ?? colorForType(item.ifc_type)),
        transparent: true,
        opacity: BASE_OPACITY,
        metalness: 0.05,
        roughness: 0.75
      })
      materials.set(key, material)
      registerMaterial(byDiscipline, item.discipline, material)
    }

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(item.center[0], item.center[1], item.center[2])
    mesh.userData.guid = item.guid
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edgeMaterial))

    group.add(mesh)
    meshes.push(mesh)
    byGuid.set(item.guid, mesh)
    geometries.push(geometry)
  }

  const applySelection = makeSelection(group, byGuid, meshes)
  const applyIsolate = makeIsolate(meshes)

  return {
    group,
    meshes,
    setSelected(guid) {
      applySelection(guid ? [guid] : [])
    },
    setSelectedMany: applySelection,
    isolate: applyIsolate,
    setShellFade: makeShellFade(byDiscipline),
    centerOf(guid) {
      const mesh = byGuid.get(guid)
      if (!mesh) return null
      return [mesh.position.x, mesh.position.y, mesh.position.z]
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose()
      for (const mesh of meshes) {
        const edge = mesh.children[0] as THREE.LineSegments | undefined
        edge?.geometry.dispose()
      }
      for (const material of materials.values()) material.dispose()
      edgeMaterial.dispose()
      group.clear()
    }
  }
}

/** 用批量网格数据构建真实三角网格模型图层（mode 决定专业配色或 IFC 原生颜色）。 */
export function buildMeshLayer(items: ElementMesh[], mode: ColorMode = 'discipline'): ModelLayer {
  const group = new THREE.Group()
  const meshes: THREE.Mesh[] = []
  const geometries: THREE.BufferGeometry[] = []
  const materials = new Map<string, THREE.MeshStandardMaterial>()
  const byDiscipline = new Map<string, Set<THREE.MeshStandardMaterial>>()
  const byGuid = new Map<string, THREE.Mesh>()

  for (const item of items) {
    const geometry = new THREE.BufferGeometry()
    const verts = new Float32Array(item.verts)
    const indices = new Uint32Array(item.faces)
    geometry.setAttribute('position', new THREE.BufferAttribute(verts, 3))
    geometry.setIndex(new THREE.BufferAttribute(indices, 1))
    geometry.computeVertexNormals()
    geometry.computeBoundingBox()

    const key = materialKey(item, mode)
    let material = materials.get(key)
    if (!material) {
      const glass = isGlass(item)
      material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(modeColor(item, mode) ?? colorForType(item.ifc_type)),
        transparent: true,
        opacity: glass ? GLASS_OPACITY : BASE_OPACITY,
        metalness: glass ? 0.1 : 0.05,
        roughness: glass ? 0.15 : 0.75,
        side: THREE.DoubleSide
      })
      if (glass) {
        // 玻璃关深度写入避免双面半透明自遮挡；userData 标记供外壳淡化回填时识别。
        material.depthWrite = false
        material.userData.isGlass = true
      }
      materials.set(key, material)
      registerMaterial(byDiscipline, item.discipline, material)
    }

    const mesh = new THREE.Mesh(geometry, material)
    mesh.userData.guid = item.guid
    // 多模型真实网格叠加：按模型地理参考偏移整体平移，使不同模型对齐到同一空间。
    if (item.position_offset) mesh.position.set(...item.position_offset)

    group.add(mesh)
    meshes.push(mesh)
    byGuid.set(item.guid, mesh)
    geometries.push(geometry)
  }

  const applySelection = makeSelection(group, byGuid, meshes)
  const applyIsolate = makeIsolate(meshes)

  return {
    group,
    meshes,
    setSelected(guid) {
      applySelection(guid ? [guid] : [])
    },
    setSelectedMany: applySelection,
    isolate: applyIsolate,
    setShellFade: makeShellFade(byDiscipline),
    centerOf(guid) {
      const mesh = byGuid.get(guid)
      if (!mesh) return null
      const box = mesh.geometry.boundingBox
      if (!box) return null
      const center = box.getCenter(new THREE.Vector3())
      // 中心点需叠加模型平移偏移（多模型叠加时定位才准确）。
      center.add(mesh.position)
      return [center.x, center.y, center.z]
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose()
      for (const material of materials.values()) material.dispose()
      group.clear()
    }
  }
}
