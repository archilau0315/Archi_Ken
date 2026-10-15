// 视角预设与演示视图（M10）：标准视角定义、相机状态存取、命名视角的本地持久化。
// IFC 模型为 Z-up，所有预设以 +Z 为上方。

import * as THREE from 'three'

export type ViewMode = 'perspective' | 'orthographic'
export type PresetName = 'iso' | 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'

export interface ViewState {
  mode: ViewMode
  position: [number, number, number]
  target: [number, number, number]
  up: [number, number, number]
  /** 正交模式下的缩放系数。 */
  zoom: number
}

export interface SavedView {
  id: string
  name: string
  state: ViewState
  created_at: string
}

/** 标准视角方向（单位向量，Z-up）。 */
const PRESET_DIR: Record<PresetName, THREE.Vector3> = {
  iso: new THREE.Vector3(1, 0.75, 1).normalize(),
  top: new THREE.Vector3(0, 0, 1),
  bottom: new THREE.Vector3(0, 0, -1),
  front: new THREE.Vector3(0, -1, 0),
  back: new THREE.Vector3(0, 1, 0),
  left: new THREE.Vector3(-1, 0, 0),
  right: new THREE.Vector3(1, 0, 0)
}

const UP_Z = new THREE.Vector3(0, 0, 1)
const UP_Y = new THREE.Vector3(0, 1, 0)

export function isPresetName(value: string): value is PresetName {
  return value in PRESET_DIR
}

/** 计算某预设在给定目标点与取景距离下的相机位置与 up 向量。 */
export function presetPlacement(
  preset: PresetName,
  target: THREE.Vector3,
  distance: number
): { position: THREE.Vector3; up: THREE.Vector3 } {
  const position = target.clone().addScaledVector(PRESET_DIR[preset], distance)
  // 顶 / 底视图视线与 Z 轴平行，up 改用 +Y 避免退化。
  const up = preset === 'top' || preset === 'bottom' ? UP_Y : UP_Z
  return { position, up }
}

const STORAGE_PREFIX = 'archiken:views:'

function storageKey(modelPath: string): string {
  const base = modelPath.split(/[\\/]/).pop() ?? 'default'
  return `${STORAGE_PREFIX}${base}`
}

/** 读取某模型保存的演示视角（按添加顺序）。 */
export function loadViews(modelPath: string): SavedView[] {
  try {
    const raw = localStorage.getItem(storageKey(modelPath))
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedView[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** 覆盖保存某模型的演示视角列表。 */
export function saveViews(modelPath: string, views: SavedView[]): void {
  try {
    localStorage.setItem(storageKey(modelPath), JSON.stringify(views))
  } catch {
    // 本地存储不可用时静默降级（演示视角仅当前会话有效）
  }
}

/** 构造一个新的命名视角记录。 */
export function createSavedView(name: string, state: ViewState): SavedView {
  return {
    id: `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    state,
    created_at: new Date().toISOString()
  }
}
