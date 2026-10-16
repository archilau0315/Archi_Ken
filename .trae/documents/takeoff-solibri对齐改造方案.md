# 信息提取（ITO）对齐 Solibri 改造方案

## Context

当前信息提取面板是「单页表单 + 结果表」：用户打开后看到的是空白的自定义列、3 个抽象输入框、5 个建议 chip，没有任何开箱即用的内容，需要自行摸索「选列 → 运行 → 看结果」的流程。

Solibri ITO 的核心设计是「预定义 Definition + 左树右表 + 按类型过滤 + 分组小计 + 用户模板库」，用户打开就能选模板看结果，并能保存自己调好的模板。本次改造完全对齐这一模式，**含用户模板完整持久化**（用户已确认）。

## 目标

1. 打开面板即可看到预定义模板树（墙体 / 门窗 / 空间 / 柱梁板等），点击任意模板**立即出结果**，无需先配列
2. 结果按楼层 / 类型自动分组，每组小计、底部总合计
3. 用户可基于现有模板克隆改列、保存为「我的模板」，跨会话保留；可重命名 / 删除
4. 内置模板与用户模板在树上分组展示、有明确区分

## 现状摸底（关键文件）

- 内核提取：[kernel/app/takeoff/extract.py](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/aitools/Archi_Ken/kernel/app/takeoff/extract.py) `run_takeoff` 遍历 `IfcProduct`、跳过 `_SPATIAL_TYPES`（含 IfcSpace），返回 `{rows, totals, columns}`；**不支持 ifc_type 过滤与分组**
- 内核列定义：[kernel/app/takeoff/columns.py](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/aitools/Archi_Ken/kernel/app/takeoff/columns.py) `FIXED_FIELDS` + `SUGGESTED_COLUMNS`
- 内核路由：[kernel/app/routes/takeoff.py](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/aitools/Archi_Ken/kernel/app/routes/takeoff.py) `/columns` `/run` `/export`
- 表达式：[kernel/app/takeoff/expr.py](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/aitools/Archi_Ken/kernel/app/takeoff/expr.py) `attr / prop / qty / val / if / round` 等函数已就绪
- 前端：[src/takeoff/TakeoffPanel.tsx](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/aitools/Archi_Ken/src/takeoff/TakeoffPanel.tsx) 单页表单
- 前端布局模式：[src/ruleset-editor/RulesetEditor.tsx](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/aitools/Archi_Ken/src/ruleset-editor/RulesetEditor.tsx) L289-326 `.editor-body`（grid 220px 1fr）→ `.editor-list` + `.editor-main`
- L3 持久化模式：[server/ruleset/store.ts](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/aitools/Archi_Ken/server/ruleset/store.ts) 文件型 JSON 存储（`.data/rulesets/<id>.json`）、原子写入、`ID_RE` 校验、`makeId` slug 生成
- L3 路由模式：[server/routes/ruleset.ts](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/aitools/Archi_Ken/server/routes/ruleset.ts) Handler 导出 + `readJsonBody` + `httpError`

## 架构分工

| 层 | 职责 |
|---|---|
| **内核（Python, 4319）** | 内置 12 个 Definition 模板硬编码；提供 ifc_type 过滤 / 分组小计 / Excel 分组导出能力；**不存用户数据** |
| **L3（Node, 4318）** | 用户模板 CRUD + 文件型持久化（`.data/takeoff-definitions/<id>.json`）；透传内核调用 |
| **前端（5173）** | 左树右表布局；从内核拉内置模板、从 L3 拉用户模板，合并展示；运行/导出/保存模板 |

## 改造方案

### 一、内核：内置 Definition + 过滤/分组能力

**1. 新建 `kernel/app/takeoff/definitions.py`**（≤200 行）

12 个内置模板，按 4 大类：

| 分类 | id | 名称 | ifc_types | 列（key → expr） | group_by |
|---|---|---|---|---|---|
| 建筑 | walls | 墙体工程量 | IfcWall, IfcWallStandardCase | length/area/volume → `qty('...')` | container |
| 建筑 | doors | 门统计 | IfcDoor | width/height/area | container |
| 建筑 | windows | 窗统计 | IfcWindow | width/height/area | container |
| 建筑 | spaces | 空间面积 | IfcSpace | area/volume | container |
| 建筑 | railings | 栏杆长度 | IfcRailing | length | container |
| 建筑 | stairs | 楼梯 | IfcStair, IfcStairFlight | volume | container |
| 结构 | columns | 柱 | IfcColumn | height/volume | container |
| 结构 | beams | 梁 | IfcBeam | length/volume | container |
| 结构 | slabs | 板 | IfcSlab | area/volume | container |
| 机电 | ducts | 风管 | IfcDuctSegment, IfcDuctFitting | length | container |
| 机电 | pipes | 水管 | IfcPipeSegment, IfcPipeFitting | length | container |
| 通用 | all | 全部构件 | （无过滤） | volume/area/length | ifc_type |

Definition 字段：`id / category / name / name_en / description / description_en / ifc_types / columns / group_by`。`group_by` 取值 `container` 或 `ifc_type`。

**2. 扩展 [kernel/app/takeoff/extract.py](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/aitools/Archi_Ken/kernel/app/takeoff/extract.py)**

- `run_takeoff` 新增参数 `ifc_types: list[str] | None = None`、`group_by: str | None = None`
- 过滤：传入 `ifc_types` 时只遍历这些类型；当列表含 `IfcSpace` 时，从 `_SPATIAL_TYPES` 跳过集合里豁免
- 分组：按 `group_by` 字段（`container` / `ifc_type`）把行装入 `groups: [{key, rows, subtotals}]`；不分组时省略 `groups` 字段，保持现有返回兼容

**3. 扩展 [kernel/app/routes/takeoff.py](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/aitools/Archi_Ken/kernel/app/routes/takeoff.py)**

- `GET /takeoff/definitions?lang=` 返回本地化内置模板列表（复用 `localize_columns` 思路，加 `localize_definitions`）
- `POST /takeoff/run` 请求体新增 `ifc_types: list[str] | None`、`group_by: str | None`（不接 `definition_id`，由前端/L3 解析后透传具体参数）
- `POST /takeoff/export` 同步新增这两个字段

**4. 扩展 [kernel/app/takeoff/export.py](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/aitools/Archi_Ken/kernel/app/takeoff/export.py)**

- 结果含 `groups` 时：组标题行（合并单元格 + 加粗底色）→ 组内明细 → 组小计行
- 末尾总合计行（加粗）

### 二、L3：用户模板持久化

**1. 新建 `server/takeoff-definition/model.ts`**（≤80 行）

类型与校验（复用 [server/ruleset/model.ts](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/aitools/Archi_Ken/server/ruleset/model.ts) 模式）：

```ts
interface TakeoffColumn { key: string; name: string; expr: string }
interface TakeoffDefinition {
  id: string
  name: string
  description: string
  category: string          // 用户自定义分类名，缺省「我的模板」
  ifc_types: string[]       // 空数组 = 不过滤
  columns: TakeoffColumn[]
  group_by: 'container' | 'ifc_type' | ''
  updated_at: string
}
```

校验：`name` 非空、`columns` 至少 1 列且 key 唯一、`group_by` 枚举值合法；**不校验 expr 语法**（交给内核在 run 时报错，与规则集校验内核 DSL 的做法一致——可调用内核 `/takeoff/validate-columns` 或直接放过）。

**2. 新建 `server/takeoff-definition/store.ts`**（≤120 行）

完全复刻 [server/ruleset/store.ts](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/aitools/Archi_Ken/server/ruleset/store.ts)：

- 存储目录 `.data/takeoff-definitions/`
- `listDefinitions / getDefinition / saveDefinition / deleteDefinition`
- `makeId(name)` 生成 slug + 时间戳
- 原子写入（tmp + rename）

**3. 新建 `server/routes/takeoff-definition.ts`**（≤100 行）

5 个 Handler：
- `GET /takeoff-definitions/list` → `{ total, items }`（摘要：id/name/category/columns_count/updated_at）
- `GET /takeoff-definitions/get?id=` → 完整定义
- `POST /takeoff-definitions/save` → 新建或覆盖（body 含 id 则覆盖）
- `POST /takeoff-definitions/delete` → body 含 id
- （可选）`POST /takeoff-definitions/duplicate` → body 含 id，复制后落库新 id

在 [server/index.ts](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/aitools/Archi_Ken/server/index.ts) 注册路由。

### 三、前端：重做 TakeoffPanel

**1. 重写 [src/takeoff/TakeoffPanel.tsx](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/aitools/Archi_Ken/src/takeoff/TakeoffPanel.tsx)**（≤450 行）

布局：

```
┌──────────────────────────────────────────────────────┐
│ 信息提取（ITO）· Definition 模板              [关闭] │
├───────────────┬──────────────────────────────────────┤
│ ▼ 内置·建筑   │ [名称: 墙体工程量____]               │
│   墙体工程量  │ [描述: 按楼层统计墙体…____]          │
│   门统计      │ 分组: [按楼层 ▾]                     │
│   窗统计      │ [▶ 运行] [导出 Excel]                │
│   空间面积    │ [自定义列…] [💾 另存为我的模板]      │
│   栏杆/楼梯   │ ┌──────────────────────────────────┐ │
│ ▼ 内置·结构   │ │ ▼ 一层                     小计  │ │
│   柱 / 梁/板  │ │   墙-01  IfcWall  一层  …       │ │
│ ▼ 内置·机电   │ │ ▼ 二层                     小计  │ │
│   风管/水管   │ │   …                            │ │
│ ▼ 内置·通用   │ │ ────────────────────────────── │ │
│   全部构件    │ │ 总合计                          │ │
│ ▼ 我的模板    │ └──────────────────────────────────┘ │
│   + 新建      │                                      │
│   模板A [✎][🗑]│                                      │
└───────────────┴──────────────────────────────────────┘
```

**状态机**：
- `builtin: TakeoffDefinition[]` 来自内核 `/takeoff/definitions`
- `mine: TakeoffDefinitionSummary[]` 来自 L3 `/takeoff-definitions/list`
- `selected: { source: 'builtin' | 'mine', id: string } | null`
- `draft: TakeoffDefinition` 当前工作区配置（名称/描述/ifc_types/columns/group_by）
- `result: TakeoffRunResponse | null`
- `editMode: boolean` 是否展开列编辑器
- `dirty: boolean` draft 是否与已加载模板不一致

**关键交互**：
1. 面板打开 → 并行拉内置 + 我的模板 → 默认选中「全部构件」并自动运行
2. 点击左侧模板 → 把模板字段灌入 `draft`、置 `dirty=false`、自动运行
3. 改名称/分组/列 → 置 `dirty=true`，不自动运行；点「▶ 运行」才执行
4. 「自定义列…」→ 展开列编辑器（复用现有列编辑能力），改完点「应用」回到只读视图
5. 「💾 另存为我的模板」→ 调 L3 保存（无 id 则新建），刷新左侧树；保存内置模板的副本时自动去掉 id 字段，生成新 id
6. 我的模板项悬停显示 [✎ 重命名] [🗑 删除]，删除需二次确认
7. 工具条「分组」下拉可临时切换，不影响模板定义本身（除非点保存）

**2. 新增 [src/takeoff/takeoff.css](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/aitools/Archi_Ken/src/takeoff/takeoff.css)**（≤180 行）

- `.takeoff-dialog`：`min(1280px, 94vw)` × `86vh`
- `.takeoff-def-tree` / `.takeoff-def-cat` / `.takeoff-def-item`（参考 `.ruleset-item`）
- `.takeoff-def-item.mine` 区分用户模板（左侧加 4px 主色边）
- `.takeoff-toolbar` 顶部工具条
- `.takeoff-group-header` / `.takeoff-subtotal-row` / `.takeoff-total-row` 表格分组行
- 复用已加的内容区横向 padding（`0 16px 16px`）保持与其它弹窗一致

**3. 扩展 [src/services/kernel.ts](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/aitools/Archi_Ken/src/services/kernel.ts)** + 新建 `src/services/takeoff-definitions.ts`

- `kernel.ts`：`takeoffDefinitions(lang)` 拉内置模板；`takeoffRun` / `takeoffExport` 接受 `ifcTypes` / `groupBy`
- `takeoff-definitions.ts`：L3 CRUD 的 4 个函数（`listMyDefinitions / getMyDefinition / saveMyDefinition / deleteMyDefinition`），走项目统一的传输层（参考 `src/services/` 其它模块）

**4. i18n 补全**

`src/i18n/zh/takeoff.ts` / `src/i18n/en/takeoff.ts` 新增约 30 键：内置分类名（建筑/结构/机电/通用）、我的模板、保存/重命名/删除/确认、分组下拉、小计/总合计、空态提示等。

## 实施步骤

1. **内核**：`definitions.py` → `extract.py`（ifc_types + group_by + IfcSpace 豁免）→ `routes/takeoff.py`（新端点 + 参数）→ `export.py`（分组导出）
2. **L3**：`server/takeoff-definition/model.ts` → `store.ts` → `routes/takeoff-definition.ts` → `server/index.ts` 注册
3. **前端服务层**：`kernel.ts` 扩展 + 新建 `takeoff-definitions.ts`
4. **前端 UI**：重写 `TakeoffPanel.tsx` + 新建 `takeoff.css` + i18n
5. **联调**：跑 `start.ps1` 拉起三个服务，逐模板验证
6. **文档**：更新 `readme.md` 信息提取章节、`debug_log_1.md`

## 验证

1. **内置模板**：打开面板 → 左侧出现 12 个内置模板分 4 类 + 「我的模板」空分组；默认选中「全部构件」并自动出结果
2. **类型过滤**：点「墙体工程量」→ 结果只含 IfcWall/IfcWallStandardCase
3. **分组小计**：结果按楼层分组，组标题 + 组小计 + 底部总合计
4. **IfcSpace 提取**：点「空间面积」→ 能看到 IfcSpace 行
5. **保存我的模板**：改名称 + 改列 → 点「另存为我的模板」→ 左侧「我的模板」出现新条目；**重启前端后仍存在**
6. **重命名/删除**：对我的模板点 ✎ 改名 → 刷新后新名生效；点 🗑 删除 → 二次确认后条目消失且对应 JSON 文件被删
7. **导出**：点「导出 Excel」→ 打开 xlsx，验证组标题行 / 小计行 / 总合计行格式
8. **空模型 / 无该类型**：选「风管」在纯建筑模型上 → 空态提示而非报错
9. **冒烟**：内核 `python -c "from app.takeoff.definitions import DEFINITIONS"` 无语法错；`cd kernel && python -m pytest`（若有测试）；`tsc --noEmit` 通过；`.data/takeoff-definitions/` 目录首次保存时自动创建

## 风险

- **IfcSpace 豁免**：现有 `_SPATIAL_TYPES` 是硬编码跳过集合，需小心只在显式 `ifc_types` 含 IfcSpace 时才放行，避免「全部构件」模板误提空间
- **导出格式变化**：xlsx 多了组行，若用户之前解析过该文件需注意
- **大模型性能**：分组 + 提取一次完成；keep `limit=500` 行保护，截断时提示
- **前后端 ID 一致性**：内置模板 id（如 `walls`）与用户模板 id（如 `my-walls-lx2k3`）命名空间不同，前端树上要区分 `source` 字段，避免保存时把内置 id 直接落库变成用户模板

## 明确不做

- ❌ Definition 的导入导出 JSON 文件（如需后续再加，与规则集导入导出走同一模式）
- ❌ 3D 视图联动（点击行高亮构件）——保持现有 `onSelect` 不变
- ❌ 修改既有 `SUGGESTED_COLUMNS` 与列编辑器能力
- ❌ 按 Material / 任意 prop 分组（需要额外 prop 求值，留作后续）
