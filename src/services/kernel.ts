// 内核客户端（L4 → L2）：对 Python 计算内核端点的类型化封装。
// 仅做「传输 + 类型」，不含业务判定逻辑。

import { apiRequest } from './transport'

export interface ElementRef {
  guid: string
  name: string | null
  ifc_type: string
}

export interface KernelHealth {
  status: string
  service: string
  version: string
}

export interface IfcSummary {
  path: string
  schema: string
  exporter: string
  project: { guid?: string; name?: string | null; phase?: string | null }
  length_unit: { kind: string; prefix: string; name: string }
  unit_to_meter: number
  georeference: { present: boolean } & Record<string, unknown>
  products_total: number
  counts_by_type: Record<string, number>
}

export interface HierarchyNode {
  guid: string
  name: string | null
  ifc_type: string
  depth: number
  element_total: number
  elements_by_type: Record<string, number>
  children: HierarchyNode[]
}

export interface HierarchyResponse {
  max_depth: number
  roots: HierarchyNode[]
}

export interface ElementDetail extends ElementRef {
  description: string | null
  object_type: string | null
  tag: string | null
  type_object: ElementRef | null
  container: ElementRef | null
  psets: Record<string, Record<string, unknown>>
}

export interface BboxItem {
  guid: string
  ifc_type: string
  bbox: [number, number, number, number, number, number]
  center: [number, number, number]
  size: [number, number, number]
  triangle_count: number
  /** 专业 key（融合模型与几何接口均提供，用于按专业着色与分组）。 */
  discipline?: string
  /** 显式颜色（融合模型按专业给出）；缺省时由 IFC 类型推导。 */
  color?: string
  /** IFC 原生表面颜色（IfcStyledItem 面色，几何网格接口提供；缺省表示无样式）。 */
  ifc_color?: string
  /** 材质名（多材质构件按面组拆分时的子条目材质，如「普通玻璃」「铝板」）。 */
  material?: string
  /** 专业标准配色（几何网格接口按 discipline 映射给出，真实网格模式按专业着色用）。 */
  discipline_color?: string
  /** 网格整体平移（多模型真实网格叠加时按模型地理参考偏移，前端渲染与定位用）。 */
  position_offset?: [number, number, number]
  /** 源模型索引（融合模式提供，模型源显示开关按此过滤 3D 渲染项）。 */
  model?: number
}

export interface BboxResponse {
  total: number
  offset: number
  limit: number
  cache_hit: boolean
  items: BboxItem[]
}

export interface GeometryStats {
  elements_with_geometry: number
  triangles: number
  vertices: number
  by_type: Record<string, number>
  cache_hit: boolean
}

export interface ElementMesh extends BboxItem {
  verts: number[]
  faces: number[]
}

/** 批量网格响应（/geometry/meshes）。 */
export interface MeshBatchResponse {
  total: number
  offset: number
  limit: number
  cache_hit: boolean
  /** 该模型的地理参考平移（东 / 北 / 高，米）：多模型叠加时按此平移各网格对齐到同一空间。 */
  model_offset?: [number, number, number]
  items: ElementMesh[]
}

export interface ClashItem {
  a: ElementRef
  b: ElementRef
  contact_point: number[] | null
  triangle_pairs: number
}

export interface ClashResponse {
  total: number
  candidate_pairs: number
  triangle_tests: number
  truncated: boolean
  items: ClashItem[]
}

export interface RuleViolation {
  guid: string
  name: string | null
  ifc_type: string
  actual: unknown
  expected: unknown
  related: ElementRef | null
  reason: string
  steps: string[]
  location?: number[] | null
}

export interface RuleResult {
  rule_id: string
  name: string
  category: string
  severity: string
  check_type: string
  target_total: number
  violations: number
  truncated: boolean
  items: RuleViolation[]
}

export interface RulesResponse {
  path: string
  rules_run: number
  rules_passed: number
  rules_failed: number
  violations_total: number
  max_violations: number
  truncated: boolean
  rules: RuleResult[]
}

/** 内核健康检查。 */
export function kernelHealth(): Promise<KernelHealth> {
  return apiRequest<KernelHealth>({ target: 'kernel', method: 'GET', path: '/health' })
}

/** 文件摘要：schema、导出方、单位、构件统计。 */
export function ifcSummary(path: string, lang?: 'zh' | 'en'): Promise<IfcSummary> {
  return apiRequest<IfcSummary>({
    target: 'kernel',
    method: 'GET',
    path: '/ifc/summary',
    query: lang ? { path, lang } : { path }
  })
}

/** 空间层级树。 */
export function ifcHierarchy(path: string, maxDepth = 8): Promise<HierarchyResponse> {
  return apiRequest<HierarchyResponse>({
    target: 'kernel',
    method: 'GET',
    path: '/ifc/hierarchy',
    query: { path, max_depth: maxDepth }
  })
}

/** 单个构件详情（属性集）。 */
export function ifcElementDetail(path: string, guid: string): Promise<ElementDetail> {
  return apiRequest<ElementDetail>({
    target: 'kernel',
    method: 'GET',
    path: `/ifc/elements/${encodeURIComponent(guid)}`,
    query: { path }
  })
}

/** 构件包围盒列表（供 3D 视图按需分页加载）。 */
export function geometryBboxes(path: string, limit = 5000): Promise<BboxResponse> {
  return apiRequest<BboxResponse>({
    target: 'kernel',
    method: 'GET',
    path: '/geometry/bboxes',
    query: { path, limit }
  })
}

/** 几何统计。 */
export function geometryStats(path: string): Promise<GeometryStats> {
  return apiRequest<GeometryStats>({ target: 'kernel', method: 'GET', path: '/geometry/stats', query: { path } })
}

/** 单构件三角网格（按需）。 */
export function geometryElement(path: string, guid: string): Promise<ElementMesh> {
  return apiRequest<ElementMesh>({
    target: 'kernel',
    method: 'GET',
    path: `/geometry/elements/${encodeURIComponent(guid)}`,
    query: { path, mesh: true }
  })
}

/** 批量构件三角网格（供 3D 视图真实化显示）。 */
export function geometryMeshes(path: string, limit = 5000): Promise<MeshBatchResponse> {
  return apiRequest<MeshBatchResponse>({
    target: 'kernel',
    method: 'GET',
    path: '/geometry/meshes',
    query: { path, limit }
  })
}

/** 运行内置规则模板。 */
export function runRules(path: string, ruleIds?: string[], lang?: 'zh' | 'en'): Promise<RulesResponse> {
  return apiRequest<RulesResponse>({
    target: 'kernel',
    method: 'POST',
    path: '/rules/run',
    body: ruleIds && ruleIds.length ? { path, rule_ids: ruleIds, lang } : { path, lang }
  })
}

/** 运行硬碰撞检测。 */
export function runClash(path: string, maxClashes = 200): Promise<ClashResponse> {
  return apiRequest<ClashResponse>({
    target: 'kernel',
    method: 'GET',
    path: '/clash/run',
    query: { path, max_clashes: maxClashes }
  })
}

// ——— 冲突矩阵与碰撞分类（M4） ———

export type ClashMode = 'hard' | 'gap' | 'clearance'

export interface ClashMatrixRef extends ElementRef {
  discipline: string
  discipline_name: string
}

export interface ClashMatrixItem {
  mode: ClashMode
  cell: string
  a: ClashMatrixRef
  b: ClashMatrixRef
  distance: number | null
  contact_point: number[] | null
  triangle_pairs: number
}

export interface ClashMatrixCell {
  key: string
  a: string
  b: string
  hard: number
  gap: number
  clearance: number
  total: number
}

export interface ClashMatrixDiscipline {
  key: string
  name: string
  color: string
  element_count: number
}

export interface ClashMatrixResponse {
  path: string
  unit_to_meter: number
  modes: { hard: boolean; gap: boolean; clearance: boolean }
  thresholds: { gap: number | null; clearance: number | null }
  disciplines: ClashMatrixDiscipline[]
  cells: ClashMatrixCell[]
  totals: { hard: number; gap: number; clearance: number; total: number }
  candidate_pairs: number
  triangle_tests: number
  ignored: number
  truncated: boolean
  items: ClashMatrixItem[]
}

export interface ClashMatrixOptions {
  hard?: boolean
  gapMm?: number | null
  clearanceMm?: number | null
  ignoreSameDiscipline?: boolean
  ignore?: unknown[]
  maxClashes?: number
  lang?: 'zh' | 'en'
}

/** 运行冲突矩阵：按专业两两对检，含硬 / 间隙 / 净空分类与忽略规则。 */
export function clashMatrix(path: string, options: ClashMatrixOptions = {}): Promise<ClashMatrixResponse> {
  return apiRequest<ClashMatrixResponse>({
    target: 'kernel',
    method: 'POST',
    path: '/clash/matrix',
    body: {
      path,
      hard: options.hard ?? true,
      gap_mm: options.gapMm ?? null,
      clearance_mm: options.clearanceMm ?? null,
      ignore_same_discipline: options.ignoreSameDiscipline ?? true,
      ignore: options.ignore,
      max_clashes: options.maxClashes ?? 300,
      lang: options.lang
    }
  })
}

// ——— 模型加载与融合（M1） ———

export interface DisciplineDef {
  key: string
  name: string
  color: string
}

export interface DisciplineRule {
  key: string
  keywords?: string[]
  prefixes?: string[]
}

export interface FederationRuleTable {
  disciplines: DisciplineDef[]
  name_rules: DisciplineRule[]
  type_rules: DisciplineRule[]
  model_rules: DisciplineRule[]
}

export interface FederationDiscipline extends DisciplineDef {
  element_count: number
  geo_count: number
  models: number[]
  element_types: Record<string, number>
}

export interface FederationModelSummary {
  index: number
  path: string
  name: string
  schema: string
  exporter: string
  project: IfcSummary['project']
  unit_to_meter: number
  georef_applied: boolean
  georeference: Record<string, unknown>
  discipline_hint: { key: string; reason: string }
  products: number
  geo_elements: number
  disciplines: Record<string, number>
  geo_disciplines: Record<string, number>
  geometry_cache_hit: boolean
}

export interface FederationElement {
  uid: string
  guid: string
  name: string | null
  ifc_type: string
  model: number
  model_name: string
  discipline: string
  discipline_name: string
  color: string
  bbox: [number, number, number, number, number, number]
  center: [number, number, number]
  size: [number, number, number]
  triangle_count: number
  material?: string | null
  parent_guid?: string | null
}

export interface FederatedTreeNode {
  kind: 'model' | 'spatial'
  key?: string
  guid?: string
  name: string | null
  path?: string
  ifc_type: string | null
  depth?: number
  element_total: number
  elements_by_type?: Record<string, number>
  elements_by_discipline?: Record<string, number>
  discipline_hint?: { key: string; reason: string }
  children: FederatedTreeNode[]
}

export interface FederationTree {
  max_depth: number
  roots: FederatedTreeNode[]
}

export interface FederationResponse {
  models: FederationModelSummary[]
  disciplines: FederationDiscipline[]
  totals: {
    models: number
    products: number
    geo_elements: number
    disciplines: number
    guid_conflicts: number
  }
  guid_conflicts: { guid: string; models: number[] }[]
  elements: { total: number; limit: number; items: FederationElement[] }
  tree: FederationTree
}

export interface FederationOptions {
  normalize?: boolean
  maxDepth?: number
  limit?: number
  lang?: 'zh' | 'en'
}

/** 专业定义与自动映射规则表。 */
export function federationDisciplines(lang?: 'zh' | 'en'): Promise<FederationRuleTable> {
  return apiRequest<FederationRuleTable>({
    target: 'kernel',
    method: 'GET',
    path: '/federation/disciplines',
    query: lang ? { lang } : {}
  })
}

/** 融合多个 IFC 模型：统一构件表（坐标归一）+ 专业聚合 + 融合模型树。 */
export function federationMerge(paths: string[], options: FederationOptions = {}): Promise<FederationResponse> {
  return apiRequest<FederationResponse>({
    target: 'kernel',
    method: 'POST',
    path: '/federation/merge',
    body: {
      paths,
      normalize: options.normalize ?? true,
      max_depth: options.maxDepth ?? 8,
      limit: options.limit ?? 2000,
      lang: options.lang
    }
  })
}

/** 把融合构件映射为 3D 视图使用的包围盒项（按专业着色）。 */
export function federationToBboxItems(elements: FederationElement[]): BboxItem[] {
  return elements.map((item) => ({
    guid: item.uid,
    ifc_type: item.ifc_type,
    bbox: item.bbox,
    center: item.center,
    size: item.size,
    triangle_count: item.triangle_count,
    discipline: item.discipline,
    color: item.color,
    // 保留源模型索引：模型源显示开关按此过滤 3D 渲染项。
    model: item.model
  }))
}

// ——— 规则模板与校验（M3 规则引擎与规则集） ———

/** 检查类型（与内核规则 DSL v1 对齐）。 */
export type CheckType = 'property' | 'intersection' | 'clearance' | 'duplicate' | 'headroom' | 'dimension'

/** 单条规则（与内核规则 DSL v1 对齐）。 */
export interface RuleSpec {
  id: string
  name?: string
  category?: string
  severity?: 'error' | 'warning' | 'info'
  target: { ifc_type?: string[] | string; where?: unknown[] }
  check: { type: CheckType | string; [key: string]: unknown }
  message?: string
}

export interface RuleTemplatesResponse {
  total: number
  items: RuleSpec[]
}

export interface RuleValidateResponse {
  valid: boolean
  total: number
  rules: RuleSpec[]
}

/** 内置规则模板列表（供规则编辑器「从模板添加」）。 */
export function ruleTemplates(lang?: 'zh' | 'en'): Promise<RuleTemplatesResponse> {
  return apiRequest<RuleTemplatesResponse>({
    target: 'kernel',
    method: 'GET',
    path: '/rules/templates',
    query: lang ? { lang } : {}
  })
}

/** 校验规则定义（不需要模型）；不合法时内核返回 400，此处抛出可读错误。 */
export function validateRules(rules: RuleSpec[]): Promise<RuleValidateResponse> {
  return apiRequest<RuleValidateResponse>({
    target: 'kernel',
    method: 'POST',
    path: '/rules/validate',
    body: { rules }
  })
}

// ——— 合规性检查预设（M5：无障碍 / 净高 / 消防） ———

/** 合规预设规则集（含展开后的规则，可直接追加到规则集草稿）。 */
export interface RulePreset {
  id: string
  name: string
  description: string
  categories: string[]
  rule_ids: string[]
  rules: RuleSpec[]
}

export interface RulePresetsResponse {
  total: number
  items: RulePreset[]
}

/** 合规性检查预设规则集列表。 */
export function rulePresets(lang?: 'zh' | 'en'): Promise<RulePresetsResponse> {
  return apiRequest<RulePresetsResponse>({
    target: 'kernel',
    method: 'GET',
    path: '/rules/presets',
    query: lang ? { lang } : {}
  })
}

// ——— IDS 校验与编辑器（M7） ———

/** IDS facet 预览（适用性 / 要求）。 */
export interface IdsFacetPreview {
  facet_type: string
  label?: string | null
  value?: string | null
  description: string
}

/** 单条 IDS 规范预览。 */
export interface IdsSpecPreview {
  name: string | null
  description: string | null
  identifier: string | null
  ifc_version: string[] | null
  cardinality: string
  applicability: IdsFacetPreview[]
  requirements: IdsFacetPreview[]
}

/** IDS 文档结构预览。 */
export interface IdsDocumentPreview {
  info: Record<string, unknown>
  specification_count: number
  specifications: IdsSpecPreview[]
}

export interface IdsExampleResponse {
  xml: string
  spec: IdsDocumentPreview
}

export interface IdsParseResponse {
  xml: string
  spec: IdsDocumentPreview
}

/** 校验结果中的构件摘要。 */
export interface IdsEntityRef {
  guid: string | null
  ifc_type: string
  name: string | null
  predefined_type: string | null
  reason?: string
}

export interface IdsRequirementResult {
  facet_type: string
  label: string | null
  value: string | null
  description: string
  status: boolean | null
  total_applicable: number
  total_pass: number
  total_fail: number
  percent_pass: number | string
  passed_total: number
  failed_total: number
  passed_entities: IdsEntityRef[]
  failed_entities: IdsEntityRef[]
}

export interface IdsSpecificationResult {
  name: string | null
  description: string | null
  instructions: string | null
  status: boolean | null
  is_skipped: boolean | null
  is_ifc_version: boolean | null
  cardinality: string
  applicability: string[]
  total_applicable: number
  total_applicable_pass: number
  total_applicable_fail: number
  percent_applicable_pass: number | string
  total_checks: number
  total_checks_pass: number
  total_checks_fail: number
  percent_checks_pass: number | string
  applicable_total: number
  applicable_entities: IdsEntityRef[]
  requirements: IdsRequirementResult[]
}

export interface IdsValidateResponse {
  status: boolean
  title: string
  filename: string | null
  date: string
  entity_limit: number
  totals: Record<string, number | string>
  specifications: IdsSpecificationResult[]
}

export interface IdsValidateOptions {
  hideSkipped?: boolean
  entityLimit?: number
}

/** 内置示例 IDS（供编辑器「载入示例」）。 */
export function idsExample(): Promise<IdsExampleResponse> {
  return apiRequest<IdsExampleResponse>({ target: 'kernel', method: 'GET', path: '/ids/example' })
}

/** 解析 IDS XML：返回规范化 XML 与结构预览。 */
export function idsParse(xml: string): Promise<IdsParseResponse> {
  return apiRequest<IdsParseResponse>({ target: 'kernel', method: 'POST', path: '/ids/parse', body: { xml } })
}

/** 对模型执行 IDS 校验。 */
export function idsValidate(path: string, xml: string, options: IdsValidateOptions = {}): Promise<IdsValidateResponse> {
  return apiRequest<IdsValidateResponse>({
    target: 'kernel',
    method: 'POST',
    path: '/ids/validate',
    body: {
      path,
      xml,
      hide_skipped: options.hideSkipped ?? false,
      entity_limit: options.entityLimit ?? 100
    }
  })
}

// ——— ITO / QTO 信息提取（M6） ———

/** 自定义计算列定义（expr 为受控表达式）。 */
export interface TakeoffColumn {
  key: string
  name: string
  expr: string
}

export interface TakeoffColumnInfo extends TakeoffColumn {
  desc?: string
}

export interface TakeoffColumnsResponse {
  fixed: { key: string; name: string }[]
  suggested: TakeoffColumn[]
  functions: { name: string; desc: string }[]
}

export interface TakeoffRow {
  guid: string
  name: string | null
  ifc_type: string
  container: string | null
  values: Record<string, unknown>
}

export interface TakeoffRunResponse {
  path: string
  total: number
  truncated: boolean
  cache_hit: boolean
  expression_errors: number
  columns: TakeoffColumn[]
  totals: Record<string, number>
  rows: TakeoffRow[]
}

export interface TakeoffExportResponse {
  file: string
  total: number
  expression_errors: number
}

/** 把模型文件上传到服务端（浏览器开发期），返回保存后的绝对路径。 */
export async function uploadModelFile(file: File, lang?: 'zh' | 'en'): Promise<{ path: string; name: string; size: number }> {
  const buf = await file.arrayBuffer()
  const params = new URLSearchParams({ name: file.name })
  if (lang) params.set('lang', lang)
  const res = await fetch(`/api/server/upload?${params.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: buf
  })
  if (!res.ok) {
    const text = await res.text()
    try {
      const parsed = JSON.parse(text) as { detail?: string; error?: string }
      throw new Error(parsed.detail ?? parsed.error ?? text)
    } catch {
      throw new Error(text || `上传失败（HTTP ${res.status}）`)
    }
  }
  return res.json()
}

/** 列定义说明：固定字段 + 内置建议列 + 可用函数。 */
export function takeoffColumns(lang?: 'zh' | 'en'): Promise<TakeoffColumnsResponse> {
  return apiRequest<TakeoffColumnsResponse>({
    target: 'kernel',
    method: 'GET',
    path: '/takeoff/columns',
    query: lang ? { lang } : {}
  })
}

/** 执行信息提取（固定字段 + 自定义列求值）。 */
export function takeoffRun(path: string, columns?: TakeoffColumn[], limit = 500, lang?: 'zh' | 'en'): Promise<TakeoffRunResponse> {
  return apiRequest<TakeoffRunResponse>({
    target: 'kernel',
    method: 'POST',
    path: '/takeoff/run',
    body: { path, columns, limit, lang }
  })
}

/** 执行信息提取并导出 Excel，返回文件路径。 */
export function takeoffExport(path: string, columns?: TakeoffColumn[], lang?: 'zh' | 'en'): Promise<TakeoffExportResponse> {
  return apiRequest<TakeoffExportResponse>({
    target: 'kernel',
    method: 'POST',
    path: '/takeoff/export',
    body: { path, columns, lang }
  })
}
