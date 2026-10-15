# 筑审通 ArchiKen

**面向设计院、施工单位与 BIM 咨询方的模型质量检查与合规审查桌面应用** —— 对标 Solibri，基于 IFC / IDS / BCF 国际开放标准，目标在**功能覆盖度、处理精度、运行性能**三项指标上达到或超越 Solibri 现有水平。

**A BIM model quality & compliance checking desktop application for design institutes, contractors and BIM consultants** — positioned against Solibri, built on the open international standards IFC / IDS / BCF, aiming to match or exceed Solibri in **feature coverage, processing accuracy and runtime performance**.

![kernel](https://img.shields.io/badge/kernel-v0.12.0-1f6feb) ![server](https://img.shields.io/badge/server-v0.6.0-1f6feb) ![React](https://img.shields.io/badge/React-18-61dafb) ![Electron](https://img.shields.io/badge/Electron-30-47848f) ![FastAPI](https://img.shields.io/badge/FastAPI-IfcOpenShell-009688)

> **合规边界**：本项目基于黑盒功能分析与国际公开标准（IFC / IDS / BCF）实现 —— **不做二进制反编译、不破解授权、不复刻 Solibri 私有 `.smc` 文件格式**。
>
> **Compliance boundary**: this project is implemented via black-box feature analysis and open international standards (IFC / IDS / BCF) — **no binary decompilation, no license cracking, no replication of Solibri's proprietary `.smc` format**.
>
> 完整技术路线与分阶段开发计划见 [.trae/documents/ArchiKen_逆向开发技术路线与分阶段开发计划.md](.trae/documents/ArchiKen_逆向开发技术路线与分阶段开发计划.md)（V0.2）。
>
> Full technical roadmap and phased development plan: [.trae/documents/ArchiKen_逆向开发技术路线与分阶段开发计划.md](.trae/documents/ArchiKen_逆向开发技术路线与分阶段开发计划.md) (V0.2, Chinese).

---

## 目录 / Contents

- [一、核心能力](#一核心能力)
- [二、技术栈](#二技术栈)
- [三、快速开始](#三快速开始)
- [四、目录结构](#四目录结构)
- [五、模块清单](#五模块清单)
- [六、服务接口](#六服务接口)
- [七、工具链](#七工具链)
- [八、关键机制](#八关键机制)
- [九、界面架构（L4）](#九界面架构l4)
- [十、国际化（中英双语）](#十国际化中英双语)
- [十一、开发规范](#十一开发规范)
- [十二、云端部署与版本同步](#十二云端部署与版本同步)

---

## 一、核心能力 / Core Capabilities

| 能力 | 说明 |
|---|---|
| IFC 模型解析 | 摘要 / 空间层级 / 构件属性，多专业模型融合与专业自动映射 |
| 规则化检查 | 规则 DSL v1 + 24 个内置模板，规则集编辑器（保存 / 复用 / 校验 / 运行） |
| 碰撞与干涉检测 | 硬碰撞 + 冲突矩阵（硬 / 间隙 / 净空分类、忽略规则、专业两两对检） |
| 合规性检查 | 无障碍 / 净高 / 消防专用规则集，净高与净尺寸检查，预设一键套用 |
| IDS 校验 | buildingSMART IDS：编辑 / 导入 / 导出 / 逐规范校验报告 |
| 信息提取 | ITO / QTO：工程量推导、受控表达式自定义列、Excel 导出 |
| 沟通协作 | 问题清单生命周期 / 评论 / 视图快照，BCF 2.1 导出（可导入 Solibri / Navisworks） |
| 检查报告 | 统一问题清单 → HTML 预览 / PDF / Excel 导出 |
| 批量自动化 | Autorun 无人值守批量检查，报告产物落盘与分发目录复制 |
| 视图系统 | 透视 / 平面（2D）切换、七标准视角、三向剖切（含 3D 内拖拽实时调节）、3D 标记、演示视角播放 |
| 3D 真实化 | 逐构件三角网格真实显示（批量网格端点），包围盒降级兜底 |
| 中英双语 | 界面一键切换，默认中文，本机记忆 |

| Capability | Description |
|---|---|
| IFC parsing | Summary / spatial hierarchy / element properties; multi-model federation with automatic discipline mapping |
| Rule-based checking | Rule DSL v1 + 24 built-in templates; ruleset editor (save / reuse / validate / run) |
| Clash detection | Hard clash + clash matrix (hard / gap / clearance classification, ignore rules, discipline pairwise checks) |
| Compliance checking | Accessibility / headroom / fire-safety rulesets, headroom & clear-dimension checks, one-click presets |
| IDS validation | buildingSMART IDS: edit / import / export / per-specification validation reports |
| Takeoff | ITO / QTO: quantity derivation, custom columns via controlled expressions, Excel export |
| Communication | Issue lifecycle / comments / view snapshots; BCF 2.1 export (importable into Solibri / Navisworks) |
| Reports | Unified issue list → HTML preview / PDF / Excel export |
| Batch automation | Autorun unattended batch checking with report artifacts and distribution-folder copy |
| View system | Perspective / plan (2D) toggle, seven standard views, 3-axis section clipping, 3D markers, presentation viewpoints |
| 3D real mesh | Per-element real triangle-mesh display (batch mesh endpoint), bbox fallback |
| Bilingual UI | Chinese / English one-click switch (Chinese default, remembered locally) |

---

## 二、技术栈 / Tech Stack

| 层 | 技术 |
|---|---|
| 桌面壳 | Electron |
| UI 交互层（L4） | React 18 + TypeScript + Vite（3D 用 three.js） |
| 业务逻辑层（L3） | Node.js + TypeScript + Koa |
| 核心计算层（L2） | Python + FastAPI + uvicorn（几何 / 解析用 IfcOpenShell） |
| 数据层（L1） | PostgreSQL + Redis（集群形态）/ SQLite（单机形态） |

各模块的选型决策与理由详见计划文档第 2.2 节。

| Layer | Technology |
|---|---|
| Desktop shell | Electron |
| UI layer (L4) | React 18 + TypeScript + Vite (three.js for 3D) |
| Business logic (L3) | Node.js + TypeScript + Koa |
| Compute kernel (L2) | Python + FastAPI + uvicorn (IfcOpenShell for geometry/parsing) |
| Data layer (L1) | PostgreSQL + Redis (cluster) / SQLite (standalone) |

See section 2.2 of the plan document for selection rationale.

---

## 三、快速开始 / Quick Start

### 环境要求 / Requirements

- Node.js 18+
- Python 3.10+（内核服务），系统可直接调用 `python` 命令（主进程以此拉起内核）
- Python 3.10+ (kernel service); the `python` command must be available on PATH (the main process launches the kernel with it)

### 一键启动（单机版推荐）/ One-click launch (recommended for standalone use)

Windows 用户直接**双击 `start.bat`** 即可：脚本自动完成环境自检（Python / Node / 依赖，缺失时自动安装）、依次拉起计算内核 (4319)、业务服务 (4318) 与前端 (5173)，并自动打开浏览器。已在运行的服务会自动复用，不会重复启动。**双击 `stop.bat`** 一键停止全部服务。

On Windows, simply **double-click `start.bat`**: it self-checks the environment (Python / Node / dependencies, auto-installing missing ones), starts the kernel (4319), the L3 service (4318) and the web UI (5173) in order, then opens the browser automatically. Services already running are reused instead of being started twice. **Double-click `stop.bat`** to stop all services at once.

### 安装依赖 / Install dependencies

```powershell
# 前端与主进程依赖 / Frontend & main-process dependencies
npm install

# Python 内核依赖 / Python kernel dependencies
python -m pip install -r kernel/requirements.txt
```

### 开发模式运行 / Run in dev mode

```powershell
# 1) 启动渲染进程开发服务器（终端 A）/ Start the renderer dev server (terminal A)
npm run dev

# 2) 编译并启动 Electron（终端 B），指向开发服务器 / Build & launch Electron (terminal B), pointing at the dev server
$env:VITE_DEV_SERVER_URL="http://localhost:5173"; npm run electron
```

### 界面导览 / UI tour

启动后为三栏工作台：**左栏** 模型源与融合模型树 + 模型摘要 · **中栏** 3D 视图 · **右栏** 构件属性 + 问题清单。左栏默认已填两个内置冒烟模型（建筑 + 结构）。顶栏功能入口：

Three-pane workspace: **left** model sources & federated tree + model summary · **center** 3D view · **right** element properties + issue list. Two built-in smoke models (architecture + structure) are prefilled. Top-bar entries:

| 按钮 | 功能 |
|---|---|
| 加载融合 | 多模型融合：专业自动映射（命名 / 导出软件 / 类型三级规则）、融合模型树（模型节点带专业推断徽章、空间节点带构件级专业分布）、构件按专业着色、点击拾取查看属性 |
| 真实模型 | 拉取**全部模型源**的逐构件三角网格，按各模型的地理参考偏移（georef）叠加到同一空间，3D 视图切换为真实几何显示（包围盒降级兜底）；构建期间按钮实时显示「构建中…」；玻璃构件（窗 / 门 / 玻璃材质面组）自动半透明、框料保持实心 |
| 运行检查 | 以第一个模型源为输入，产出规则与碰撞统一问题清单 |
| 报告 | 摘要统计 + 问题清单预览（点击构件联动 3D），重新生成 / 新窗口 HTML 预览 / 一键导出 PDF / Excel 到 `.data/exports/` |
| 视图 | 3D 视图上方紧凑工具条（占布局高度、完全不遮挡画面）+ 手风琴浮窗（默认全折叠、头部可拖拽移位）。工具条承接高频操作：透视 / 平面（正交 2D）一键切换与七个标准视角（点击即到、无跳转）；X / Y / Z 三向剖切一键启用（点击轴名即切、无确认与存盘环节），滑杆实时拖动，选中「拖动」后可直接在 3D 视图中拖拽切面（沿该轴屏幕投影换算，拖拽中同步刷新）、翻转切向、全部清除；浮窗只留低频项：检查结果按严重度配色一键放置 3D 标记、点击图钉飞行定位；演示视角命名保存（localStorage）与顺序自动播放。另有一键「透视外壳」：把建筑 / 结构 / 场地淡化为半透明并关闭深度写入，透明度由旁边滑杆实时可调（5% ~ 90%，默认 12%），直接看见内部的暖通、给排水、电气管线（融合包围盒与真实网格两种模式均可用） |
| 规则集 | 规则集编辑器：新建 / 编辑 / 保存 / 复用，内置模板快速添加，合规预设一键添加（无障碍 / 净高 / 消防），支持「校验」与「运行」 |
| 碰撞矩阵 | 勾选硬碰撞 / 间隙 / 净空并设容差，可忽略同专业；运行后查看专业矩阵与问题清单，点击问题联动 3D 选中 |
| IDS 校验 | IDS 编辑器：载入示例或粘贴 IDS XML、解析预览结构、导出 XML，对模型运行校验并逐规范 / 逐要求查看通过情况与失败构件（点击联动 3D） |
| 信息提取 | ITO / QTO 面板：固定字段与建议列，自定义计算列（`qty('volume')`、`attr('Name')`、`prop(属性集,属性)` 等函数），逐构件结果与合计，一键导出 Excel |
| 沟通 | 沟通与 BCF 面板：「导入检查结果」一键生成问题清单（按标题+构件去重）；状态（待处理 / 已确认 / 已解决）与级别调整、评论、附加 3D 视角快照、定位构件、按状态 / 级别过滤；「导出 BCF」产出 BCF 2.1 zip 到 `.data/exports/` |
| EN / 中 | 界面语言切换（默认中文，本机 localStorage 记忆） |

| Button | Function |
|---|---|
| Load & Federate | Multi-model federation: automatic discipline mapping (naming / exporter / type rules), federated tree (discipline badges on model nodes, per-element distribution on spatial nodes), discipline-colored elements, click-pick to inspect properties |
| Real Mesh | Fetch per-element triangle meshes for **all model sources**, overlay them in one shared space via each model's georef offset, and switch the 3D view to real geometry (bbox fallback); the button shows live "Building…" progress; glazing (windows / doors / glass-material panels) turns auto-translucent while frames stay solid |
| Run Check | Runs rules + clash on the first model source, producing a unified issue list |
| Report | Summary statistics + issue preview (click an element to highlight in 3D), regenerate / HTML preview in a new window / one-click PDF / Excel export to `.data/exports/` |
| Views | A compact toolbar docked above the 3D view (occupies layout height, never covers the canvas) plus an accordion floating card (collapsed by default, draggable by its header). The toolbar carries high-frequency actions: one-click perspective / plan (orthographic 2D) toggle and seven standard views (instant, no navigation); X / Y / Z sections enabled by a single axis click (no confirm or save step), live slider, pick "Drag" to move a section plane directly inside the 3D view (mapped along the axis' screen projection, updating while you drag), flip direction and clear all. The floating card keeps only low-frequency items: severity-colored 3D markers from check results, click a pin to fly to it; named presentation viewpoints (localStorage) with auto-play. A one-click "X-Ray Shell" fades architecture / structure / site to translucent with depth writes disabled; its opacity is adjustable live via the adjacent slider (5% – 90%, default 12%), so the MEP pipes, ducts and cables inside become visible (works in both federated bbox mode and true-mesh mode) |
| Rulesets | Ruleset editor: create / edit / save / reuse, quick-add from built-in templates, one-click compliance presets (accessibility / headroom / fire safety), validate & run |
| Clash Matrix | Enable hard / gap / clearance with tolerances, optionally ignore same discipline; run to see the discipline matrix and issue list, click an issue to select in 3D |
| IDS Check | IDS editor: load example or paste IDS XML, parse & preview structure, export XML, validate against the model and review per-specification / per-requirement results with failing elements (click to select in 3D) |
| Takeoff | ITO / QTO panel: fixed fields and suggested columns, custom computed columns (`qty('volume')`, `attr('Name')`, `prop(pset, property)` and more), per-element results with totals, one-click Excel export |
| Communicate | Communication & BCF panel: "Import check results" builds the issue list (deduplicated by title+element); status (open / acknowledged / resolved) & severity, comments, 3D view snapshots, locate element, filters; "Export BCF" writes a BCF 2.1 zip to `.data/exports/` |
| EN / 中 | UI language switch (Chinese default, remembered in localStorage) |

### 单独运行各服务（调试用）/ Run services individually (debugging)

```powershell
npm run kernel     # L2 内核，默认 http://127.0.0.1:4319/health / L2 kernel, default http://127.0.0.1:4319/health
npm run server     # L3 业务服务，默认 http://127.0.0.1:4318/health / L3 business service, default http://127.0.0.1:4318/health
```

### 类型检查与构建 / Type check & build

```powershell
npm run typecheck  # 三个 tsconfig 全量类型检查 / full type check across all three tsconfigs
npm run build      # 构建渲染进程 + 编译主进程 / build renderer + compile main process
```

---

## 四、目录结构 / Directory Layout

```
ArchiKen/                  项目根目录（磁盘目录名保持 AchiAudit）/ project root (on-disk folder name remains AchiAudit)
├─ readme.md                 本文件（中英双语）/ this file (bilingual)
├─ debug_log_1.md            变更记录（接近 800 行时新开 debug_log_2.md）/ change log (a new debug_log_2.md starts near 800 lines)
├─ index.html                渲染进程入口 HTML（Vite）/ renderer entry HTML (Vite)
├─ package.json              依赖与脚本 / dependencies & scripts
├─ vite.config.ts            渲染进程构建配置 / renderer build config
├─ tsconfig.json             渲染进程（L4）TS 配置 / renderer (L4) TS config
├─ tsconfig.electron.json    主进程 TS 配置（编译到 dist-electron）/ main-process TS config (compiles to dist-electron)
├─ tsconfig.server.json      业务服务（L3）TS 配置 / business service (L3) TS config
├─ electron/                 主进程：窗口、内核进程守护、IPC 请求转发 / main process: window, kernel process guard, IPC request forwarding
├─ src/                      渲染进程：React UI（i18n/ 中英双语、services/ 服务客户端、viewer/ 3D 视图（含 views/ 视图系统）、model-tree/ 模型源与融合树、ruleset-editor/ 规则集编辑器、clash/ 冲突矩阵、ids/ IDS 编辑器、takeoff/ 信息提取、communication/ 沟通面板、report/ 报告面板、views/ 视图面板）
├─ kernel/                   L2 核心计算层（Python 服务）/ L2 compute kernel (Python service)
├─ server/                   L3 业务逻辑层（Koa 服务）/ L3 business logic (Koa service)
├─ corpus/                   回归语料库（清单 + 样本 + 探针模型）/ regression corpus (manifest + samples + probe models)
├─ tools/                    配套工具脚本 / companion scripts
│  ├─ corpus/                语料清单校验、冒烟模型生成 / manifest validation, smoke model generation
│  ├─ kernel/                L2 内核端到端冒烟测试 / L2 kernel end-to-end smoke tests
│  ├─ server/                L3 业务服务（规则集 + 沟通问题）端到端冒烟测试 / L3 business service (rulesets + issues) end-to-end smoke tests
│  ├─ benchmark/             黄金基准比对流水线（golden/ 黄金文件 + record/run）/ golden-master comparison pipeline (golden/ + record/run)
│  └─ perf/                  性能基线采集与回归比对（baselines/ 基线文件）/ performance baseline capture & regression compare (baselines/)
├─ .cache/                   几何缓存（.kengeo，构建产物，不入 git）/ geometry cache (.kengeo, build artifact, not in git)
├─ .data/                    业务数据（规则集 JSON、沟通问题与快照、BCF 导出、Autorun 任务与运行产物；构建产物，不入 git）/ business data (ruleset JSON, issues & snapshots, BCF exports, Autorun tasks & run artifacts; not in git)
├─ deploy/                   云端部署（Docker 编排、构建打包脚本、宝塔面板上线指南、版本同步规范、更新 SOP）/ cloud deployment (Docker orchestration, packaging script, BT-panel guide, version-sync spec, update SOP)
└─ docs/                     模块清单、功能矩阵与行为规格等文档 / module inventory, feature matrix & behavior specs
```

---

## 五、模块清单 / Module Inventory

| 层 | 目录 | 模块 | 当前状态 |
|---|---|---|---|
| L4 UI 交互层 | `src/` | 三栏工作台（多模型源与融合树 / 3D 视图 / 属性与问题）、服务客户端、规则集编辑器、冲突矩阵面板、IDS 编辑器、信息提取面板、沟通与 BCF 面板、报告面板、视图系统（非模态浮窗 / 一键视角 / 三向剖切 + 3D 拖拽 / 标记 / 演示视角）、中英双语框架（`src/i18n/`） | 已实现（v1） |
| L4 桥接 | `electron/` | 主窗口、内核进程拉起、IPC 请求转发（内核 / 业务服务） | 已实现（v1） |
| L3 业务逻辑层 | `server/` | 健康检查 + 结果与报告服务（统一问题清单 / 原因链 / HTML 报告 / PDF 与 Excel 导出）+ 规则集管理 + 沟通与 BCF（问题生命周期 / 评论 / 视图快照 / 检查结果导入 / BCF 2.1 导出）+ Autorun 批量检查 | 已实现（v1） |
| L2 核心计算层 | `kernel/` | IFC 解析 + 几何内核（`.kengeo` 缓存）+ 碰撞引擎（硬碰撞 + 冲突矩阵）+ 简化规则引擎（DSL v1 + 24 模板 + 校验）+ 合规性检查（无障碍 / 净高 / 消防）+ 模型融合与专业分类 + IDS 校验 + ITO / QTO 信息提取 + 报告渲染（PDF / Excel）+ 健康检查 | 已实现，端到端冒烟通过 |
| L1 数据层 | `corpus/` | 回归语料库（4 版本 × 4 导出方 × 4 规模档）、探针模型 | 清单与校验工具已就绪，样本待采集 |
| 横切工具 | `tools/` | 语料覆盖率校验、冒烟模型生成、内核 / 业务服务冒烟测试、黄金基准比对流水线、性能基线脚本 | 均已就绪 |

| Layer | Directory | Modules | Status |
|---|---|---|---|
| L4 UI | `src/` | Three-pane workspace (multi-source federated tree / 3D view / properties & issues), service clients, ruleset editor, clash matrix panel, IDS editor, takeoff panel, communication & BCF panel, report panel, view system (2D / clipping / markers / presentation), bilingual framework (`src/i18n/`) | Implemented (v1) |
| L4 bridge | `electron/` | Main window, kernel process spawn, IPC forwarding (kernel / business service) | Implemented (v1) |
| L3 business | `server/` | Health check + results & reports (unified issue list / reason chains / HTML report / PDF & Excel export) + ruleset management + communication & BCF (lifecycle / comments / snapshots / import / BCF 2.1 export) + Autorun batch checking | Implemented (v1) |
| L2 kernel | `kernel/` | IFC parsing + geometry kernel (`.kengeo` cache) + clash engine (hard clash + matrix) + rule engine (DSL v1 + 24 templates + validation) + compliance (accessibility / headroom / fire) + federation & discipline classification + IDS validation + ITO / QTO takeoff + report rendering (PDF / Excel) + health check | Implemented, E2E smoke passed |
| L1 data | `corpus/` | Regression corpus (4 versions × 4 exporters × 4 size tiers), probe models | Manifest & validators ready, samples pending |
| Cross-cutting | `tools/` | Corpus coverage validation, smoke model generation, kernel / server smoke tests, golden-master pipeline, performance baseline | All ready |

详细模块划分与阶段归属见 [docs/模块清单.md](docs/模块清单.md)；功能对标清单与填写规范见 [docs/功能矩阵与行为规格.md](docs/功能矩阵与行为规格.md)；语料库使用方式见 [corpus/README.md](corpus/README.md)。

Detailed module breakdown: [docs/模块清单.md](docs/模块清单.md) (Chinese); feature matrix & behavior specs: [docs/功能矩阵与行为规格.md](docs/功能矩阵与行为规格.md) (Chinese); corpus usage: [corpus/README.md](corpus/README.md).

---

## 六、服务接口 / Service APIs

### 内核服务（L2，默认 `http://127.0.0.1:4319`）/ Kernel service (L2, default `http://127.0.0.1:4319`)

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/health` | 服务健康检查 |
| GET | `/ifc/summary?path=` | 模型摘要：schema、导出方、长度单位、地理参考、构件统计 |
| GET | `/ifc/hierarchy?path=&max_depth=8` | 空间层级树（Project → Site → Building → Storey → Space） |
| GET | `/ifc/elements?path=&ifc_type=&offset=0&limit=100` | 构件分页列表（可按 IFC 类型过滤） |
| GET | `/ifc/elements/{guid}?path=` | 单构件属性：类型对象、所在空间、属性集 |
| GET | `/geometry/stats?path=` | 几何提取统计：有几何构件数、三角面总数、类型分布、缓存命中 |
| GET | `/geometry/bboxes?path=&ifc_type=&offset=&limit=` | 构件包围盒列表（含中心/尺寸/专业 key），供碰撞粗筛 |
| GET | `/geometry/elements/{guid}?path=&mesh=` | 单构件几何：包围盒必返，`mesh=true` 时返回顶点与三角面索引 |
| GET | `/geometry/meshes?path=&ifc_type=&offset=&limit=` | 批量构件三角网格：一次返回多个构件的顶点与索引（含专业 key、IFC 原生色 `ifc_color`、材质名 `material`），供 3D 视图真实化显示、按专业分组淡化、玻璃识别与显色书签 |
| GET | `/clash/run?path=&ifc_type_a=&ifc_type_b=&max_clashes=` | 硬碰撞检测：返回碰撞构件对、接触点、相交三角形数与整体统计 |
| POST | `/clash/matrix` | 冲突矩阵：按专业两两对检，分类硬碰撞 / 间隙 / 净空，支持忽略规则与单元格启停。请求体 `{path, hard?, gap_mm?, clearance_mm?, ignore_same_discipline?, ignore?, cells?, max_clashes?}` |
| GET | `/rules/templates` | 内置规则模板列表（24 个：12 条通用 + 12 条合规专用） |
| GET | `/rules/presets` | 合规预设规则集（无障碍 / 净高 / 消防 / 全套），含展开后的规则，供一键套用 |
| GET | `/rules/run?path=&rule_ids=&max_violations=` | 对模型运行内置规则，`rule_ids` 逗号分隔取子集（默认全部） |
| POST | `/rules/run` | 运行自定义规则；请求体 `{path, rules?, rule_ids?, max_violations?}`，`rules` 优先 |
| POST | `/rules/validate` | 校验规则定义（不需要模型）；请求体 `{rules}`，合法返回规范化规则，非法返回 400 + 原因 |
| GET | `/federation/disciplines` | 专业分类规则表：专业定义（key/中英文名/颜色）、命名规则、IFC 类型规则、模型规则 |
| POST | `/federation/merge` | 多模型融合；请求体 `{paths, normalize?, max_depth?, limit?}`，返回模型摘要、专业聚合、构件项与融合模型树 |
| POST | `/federation/tree` | 仅返回融合模型树；请求体同上（不含 elements） |
| GET | `/federation/merge?paths=a,b&normalize=&max_depth=&limit=` | 多模型融合的 GET 形式，`paths` 逗号分隔 |
| GET | `/ids/example` | 内置示例 IDS（原始 XML + 结构预览） |
| POST | `/ids/parse` | 解析 IDS XML；请求体 `{xml}`，返回规范化 XML 与结构预览（供编辑器导入） |
| POST | `/ids/validate` | 对模型执行 IDS 校验；请求体 `{path, xml?, ids_path?, hide_skipped?, entity_limit?}`，返回逐规范 / 逐要求的通过情况与失败构件 |
| GET | `/takeoff/columns` | 信息提取列说明：固定字段、内置建议列、受控表达式可用函数 |
| POST | `/takeoff/run` | 执行信息提取；请求体 `{path, columns?, limit?}`，`columns` 为 `[{key, name, expr}]` 自定义计算列，返回逐构件行、数值合计与表达式错误计数 |
| POST | `/takeoff/export` | 执行信息提取并导出 Excel；请求体 `{path, columns?}`，写入 `.data/exports/takeoff-<时间戳>.xlsx`（原子写入），返回文件路径与行数 |
| GET | `/takeoff/exports` | 列出已导出的 Excel 文件 |
| POST | `/report/export` | 报告渲染：把统一问题清单渲染为 PDF / Excel；请求体 `{report, format: pdf\|xlsx, title?}`，写入 `.data/exports/report-<时间戳>.<后缀>`（原子写入），返回文件信息 |
| GET | `/report/exports` | 列出已导出的报告文件（`report-*.pdf` / `report-*.xlsx`） |

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/ifc/summary?path=` | Model summary: schema, exporter, length unit, georeference, element statistics |
| GET | `/ifc/hierarchy?path=&max_depth=8` | Spatial hierarchy (Project → Site → Building → Storey → Space) |
| GET | `/ifc/elements?path=&ifc_type=&offset=0&limit=100` | Paged element list (filterable by IFC type) |
| GET | `/ifc/elements/{guid}?path=` | Single element: type object, containing space, property sets |
| GET | `/geometry/stats?path=` | Geometry extraction stats: elements with geometry, triangle totals, type distribution, cache hits |
| GET | `/geometry/bboxes?path=&ifc_type=&offset=&limit=` | Element bounding boxes (center/size/discipline key) for broad-phase clash |
| GET | `/geometry/elements/{guid}?path=&mesh=` | Single element geometry: bbox always, vertices & triangle indices when `mesh=true` |
| GET | `/geometry/meshes?path=&ifc_type=&offset=&limit=` | Batch element meshes: vertices & indices for many elements at once (incl. discipline key, native `ifc_color` and `material` names) for 3D real-mesh display, per-discipline fading, glass detection and color bookmarks |
| GET | `/clash/run?path=&ifc_type_a=&ifc_type_b=&max_clashes=` | Hard clash detection: clashing pairs, contact points, intersecting triangle counts, overall stats |
| POST | `/clash/matrix` | Clash matrix: discipline pairwise checks, hard / gap / clearance classification, ignore rules & per-cell toggles. Body `{path, hard?, gap_mm?, clearance_mm?, ignore_same_discipline?, ignore?, cells?, max_clashes?}` |
| GET | `/rules/templates` | Built-in rule templates (24: 12 generic + 12 compliance) |
| GET | `/rules/presets` | Compliance preset rulesets (accessibility / headroom / fire safety / full set), expanded rules included |
| GET | `/rules/run?path=&rule_ids=&max_violations=` | Run built-in rules; comma-separated `rule_ids` selects a subset (default all) |
| POST | `/rules/run` | Run custom rules; body `{path, rules?, rule_ids?, max_violations?}`, `rules` wins |
| POST | `/rules/validate` | Validate rule definitions (no model needed); body `{rules}`; 400 + reason when invalid |
| GET | `/federation/disciplines` | Discipline classification table: definitions (key/bilingual name/color), naming rules, IFC type rules, model rules |
| POST | `/federation/merge` | Multi-model federation; body `{paths, normalize?, max_depth?, limit?}` → model summaries, discipline aggregation, element items, federated tree |
| POST | `/federation/tree` | Federated tree only; same body (no elements) |
| GET | `/federation/merge?paths=a,b&normalize=&max_depth=&limit=` | GET form of federation, comma-separated `paths` |
| GET | `/ids/example` | Built-in example IDS (raw XML + structure preview) |
| POST | `/ids/parse` | Parse IDS XML; body `{xml}` → normalized XML + structure preview (for editor import) |
| POST | `/ids/validate` | Validate a model against IDS; body `{path, xml?, ids_path?, hide_skipped?, entity_limit?}` → per-spec / per-requirement results with failing elements |
| GET | `/takeoff/columns` | Takeoff column reference: fixed fields, suggested columns, available expression functions |
| POST | `/takeoff/run` | Run takeoff; body `{path, columns?, limit?}` where `columns` is `[{key, name, expr}]` custom computed columns → per-element rows, numeric totals, expression error count |
| POST | `/takeoff/export` | Run takeoff and export Excel; body `{path, columns?}` → `.data/exports/takeoff-<timestamp>.xlsx` (atomic write), returns file path & row count |
| GET | `/takeoff/exports` | List exported Excel files |
| POST | `/report/export` | Render unified issue list to PDF / Excel; body `{report, format: pdf\|xlsx, title?}` → `.data/exports/report-<timestamp>.<ext>` (atomic write) |
| GET | `/report/exports` | List exported report files (`report-*.pdf` / `report-*.xlsx`) |

### 业务服务（L3，默认 `http://127.0.0.1:4318`）/ Business service (L3, default `http://127.0.0.1:4318`)

需内核服务在线；内核地址可用环境变量 `ARCHIKEN_KERNEL_URL` 覆盖。

Requires the kernel online; kernel URL can be overridden via `ARCHIKEN_KERNEL_URL`.

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/health` | 服务健康检查 |
| GET | `/report/run?path=&rule_ids=&include_clash=` | 运行内核规则（默认全部模板）+ 硬碰撞，返回统一问题清单与统计 |
| POST | `/report/run` | 同上；请求体 `{path, rule_ids?, include_clash?}`，`rule_ids` 为数组 |
| GET | `/report/html?path=&rule_ids=&include_clash=` | 渲染自包含 HTML 检查报告（内联 CSS，无外部依赖） |
| POST | `/report/export` | 生成报告并导出为 PDF / Excel 文件；请求体 `{path, format: pdf\|xlsx, rule_ids?, include_clash?, title?}`，返回文件路径 / 大小 / 问题数 |
| GET | `/ruleset/list` | 规则集列表（按更新时间倒序，返回 id / name / 规则数 / 更新时间） |
| GET | `/ruleset/get?id=` | 读取单个规则集全文（缺失 id → 400；不存在 → 404） |
| POST | `/ruleset/save` | 保存规则集；请求体 `{id?, name, description?, rules}`，新建返回 201、覆盖返回 200 |
| POST | `/ruleset/delete` | 删除规则集；请求体 `{id}` |
| POST | `/ruleset/run` | 以规则集运行对应模型；请求体 `{id, path, include_clash?}`，返回统一问题清单 |
| GET | `/issues/list?status=&severity=&source=` | 沟通问题列表（可按状态 / 级别 / 来源过滤），返回摘要（含评论数、是否有快照） |
| GET | `/issues/get?id=` | 读取单个问题全文（含评论；缺失 id → 400；不存在 → 404） |
| POST | `/issues/create` | 新建沟通问题；请求体 `{title, description?, severity?, category?, source?, model_path?, element?, related?, location?}`，返回 201 |
| POST | `/issues/update` | 更新问题（状态生命周期 / 级别 / 描述等）；请求体 `{id, title?, description?, severity?, status?, category?}` |
| POST | `/issues/delete` | 删除问题及其快照；请求体 `{id}` |
| POST | `/issues/comment` | 添加评论；请求体 `{id, text, author?}` |
| POST | `/issues/snapshot` | 附加视图快照（PNG dataURL）；请求体 `{id, data_url}` |
| POST | `/issues/import` | 把检查结果导入为问题（按标题+构件 guid 去重，已存在跳过）；请求体 `{path, rule_ids?, include_clash?}`，返回 `{total, created, skipped}` |
| POST | `/issues/bcf/export` | 导出 BCF 2.1 zip；请求体 `{ids?}`（不传导出全部），写入 `.data/exports/issues-<时间戳>.bcf`，返回路径与主题数 |
| GET | `/autorun/list` | 批量检查任务列表（按更新时间倒序） |
| GET | `/autorun/get?id=` | 读取单个任务全文 |
| POST | `/autorun/save` | 保存任务；请求体 `{id?, name, models[], ruleset_id?, include_clash?, formats[], output_dir?}`，`formats` 可选 `pdf/xlsx/html/json`，新建返回 201 |
| POST | `/autorun/delete` | 删除任务（历史运行记录保留）；请求体 `{id}` |
| POST | `/autorun/run` | 一键批量无人值守运行：逐模型检查并产出报告到 `.data/autorun/runs/<run_id>/`（含 run.json manifest），设 `output_dir` 时整份复制到分发目录；同步执行，返回运行记录 |
| GET | `/autorun/runs?task_id=` | 运行记录列表（可按任务过滤，按开始时间倒序） |
| GET | `/autorun/run/get?id=` | 读取运行记录详情（逐模型状态 / 问题数 / 产物清单） |

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/report/run?path=&rule_ids=&include_clash=` | Run kernel rules (default all templates) + hard clash → unified issue list & stats |
| POST | `/report/run` | Same; body `{path, rule_ids?, include_clash?}`, `rule_ids` as array |
| GET | `/report/html?path=&rule_ids=&include_clash=` | Self-contained HTML check report (inline CSS, no external deps) |
| POST | `/report/export` | Generate & export report as PDF / Excel; body `{path, format: pdf\|xlsx, rule_ids?, include_clash?, title?}` → file path / size / issue count |
| GET | `/ruleset/list` | Ruleset list (newest first: id / name / rule count / updated time) |
| GET | `/ruleset/get?id=` | Full ruleset (missing id → 400; not found → 404) |
| POST | `/ruleset/save` | Save ruleset; body `{id?, name, description?, rules}`; 201 on create, 200 on overwrite |
| POST | `/ruleset/delete` | Delete ruleset; body `{id}` |
| POST | `/ruleset/run` | Run a ruleset against a model; body `{id, path, include_clash?}` → unified issue list |
| GET | `/issues/list?status=&severity=&source=` | Issue list (filter by status / severity / source), summaries incl. comment count & snapshot flag |
| GET | `/issues/get?id=` | Full issue incl. comments (missing id → 400; not found → 404) |
| POST | `/issues/create` | Create issue; body `{title, description?, severity?, category?, source?, model_path?, element?, related?, location?}` → 201 |
| POST | `/issues/update` | Update issue (lifecycle / severity / description etc.); body `{id, title?, description?, severity?, status?, category?}` |
| POST | `/issues/delete` | Delete issue and its snapshot; body `{id}` |
| POST | `/issues/comment` | Add comment; body `{id, text, author?}` |
| POST | `/issues/snapshot` | Attach view snapshot (PNG dataURL); body `{id, data_url}` |
| POST | `/issues/import` | Import check results as issues (dedup by title+element guid); body `{path, rule_ids?, include_clash?}` → `{total, created, skipped}` |
| POST | `/issues/bcf/export` | Export BCF 2.1 zip; body `{ids?}` (all when omitted) → `.data/exports/issues-<timestamp>.bcf` |
| GET | `/autorun/list` | Autorun task list (newest first) |
| GET | `/autorun/get?id=` | Full task |
| POST | `/autorun/save` | Save task; body `{id?, name, models[], ruleset_id?, include_clash?, formats[], output_dir?}`, `formats` ∈ `pdf/xlsx/html/json`; 201 on create |
| POST | `/autorun/delete` | Delete task (run history kept); body `{id}` |
| POST | `/autorun/run` | One-click unattended batch run: per-model checks with reports under `.data/autorun/runs/<run_id>/` (incl. run.json manifest); whole folder copied to the distribution dir when `output_dir` is set; synchronous, returns the run record |
| GET | `/autorun/runs?task_id=` | Run records (filterable by task, newest first) |
| GET | `/autorun/run/get?id=` | Run record detail (per-model status / issue counts / artifact list) |

---

## 七、工具链 / Toolchain

### 业务服务（L3）冒烟测试 / Business service (L3) smoke test

需内核与业务服务均已启动。

Requires kernel + business service running.

```powershell
python tools/server/smoke_test.py    # 规则集 CRUD + 运行 + 沟通问题 / BCF 端到端冒烟 / ruleset CRUD + run + issues / BCF end-to-end smoke
```

### 黄金基准比对（回归防劣化）/ Golden-master comparison (regression guard)

需内核已启动。`record` 把当前内核输出固化为黄金文件；`run` 重跑并逐字段比对，有差异即退出码 1（可接入提交前检查）。

Requires the kernel. `record` freezes current kernel output as golden files; `run` re-executes and compares field by field, exit code 1 on any diff (suitable as a pre-commit check).

```powershell
python tools/benchmark/benchmark.py record --model corpus/samples/_smoke/smoke-ifc4.ifc   # 录入/更新黄金文件 / record/update golden file
python tools/benchmark/benchmark.py run                                                   # 比对全部黄金文件，报告落 .data/benchmark/ / compare all golden files, report to .data/benchmark/
```

比对口径：8 组确定性检查（摘要 / 几何 / 碰撞 / 冲突矩阵 / 全部规则 / 合规规则 / IDS / 信息提取），浮点按 4 位小数归一，整数字段精确比对；已内置两个冒烟模型的黄金文件（`tools/benchmark/golden/`）。

Scope: 8 deterministic check groups (summary / geometry / clash / clash matrix / all rules / compliance rules / IDS / takeoff); floats normalized to 4 decimals, integers compared exactly; golden files for two smoke models are bundled (`tools/benchmark/golden/`).

### 性能基线采集与回归比对 / Performance baseline & regression compare

需内核已启动。对 11 个固定场景计时（best/avg），并采集内核进程内存（需 `pip install psutil`，缺失时仅计时）。

Requires the kernel. Times 11 fixed scenarios (best/avg) and captures kernel process memory (needs `pip install psutil`; timing only when missing).

```powershell
python tools/perf/perf_baseline.py                    # 直接采集并打印 / capture & print
python tools/perf/perf_baseline.py --save v0.12.0     # 保存为基线 / save baseline to tools/perf/baselines/v0.12.0.json
python tools/perf/perf_baseline.py --compare v0.12.0  # 与基线比对 / compare: regression when best degrades >20% and >50ms, exit code 1
```

### 语料库覆盖率校验 / Corpus coverage validation

```powershell
python tools/corpus/check_manifest.py               # 校验清单格式并输出覆盖矩阵 / validate manifest & print coverage matrix
python tools/corpus/check_manifest.py --check-files # 同时校验样本文件是否存在 / also verify sample files exist
```

### 内核服务（L2）冒烟测试 / Kernel service (L2) smoke test

```powershell
python tools/corpus/make_smoke_ifc.py   # 生成自建冒烟模型 / generate smoke model
python kernel/main.py                   # 启动内核服务 / start kernel (default http://127.0.0.1:4319)
python tools/kernel/smoke_test.py       # 另开终端：解析 + 几何端点端到端冒烟 / in another terminal: parsing + geometry E2E smoke
```

---

## 八、关键机制 / Key Mechanisms

### 规则 DSL v1 / Rule DSL v1

一条规则含 `id / name / severity / target / check`，`target` 用 `ifc_type` 与 `where` 条件（Pset 属性或构件属性）选定构件；`check.type` 支持：

- `property`：属性比较，支持 `unit: model/m/cm/mm`（单位换算仅对数值算子生效）
- `intersection`：跨专业相交（复用碰撞引擎）
- `clearance`：包围盒净距，支持 `axis`
- `headroom`：空间净高——目标底面到投影范围内最低遮挡构件底面的垂直净空
- `dimension`：净尺寸——包围盒指定轴向尺寸，`axis: min` 取水平两轴较小值
- `duplicate`：重复构件

结果返回逐规则违规清单与原因链 `steps`。内置模板分「通用」（通用/碰撞/模型质量）与「合规专用」（无障碍 / 净高 / 消防，分类字段 `category`）两类；`/rules/presets` 按分类打包为四个预设，供规则集编辑器一键套用。

A rule has `id / name / severity / target / check`; `target` selects elements via `ifc_type` and `where` conditions (Pset or element attributes); `check.type` supports:

- `property`: property comparison, supports `unit: model/m/cm/mm` (unit conversion applies to numeric operators only)
- `intersection`: cross-discipline intersection (reuses the clash engine)
- `clearance`: bbox clearance, supports `axis`
- `headroom`: spatial headroom — vertical clearance from the target's base to the lowest obstructing element base within the projection
- `dimension`: clear dimension — bbox size on the given axis, `axis: min` takes the smaller horizontal axis
- `duplicate`: duplicate elements

Results include per-rule violations with reason chains (`steps`). Built-in templates split into "generic" (general / clash / model quality) and "compliance" (accessibility / headroom / fire safety, via the `category` field); `/rules/presets` packages them into four one-click presets for the ruleset editor.

### 信息提取（M6）/ Takeoff (M6)

工程量（QTO v1）由几何包围盒推导——`volume / area / length / width / height`（模型单位，跳过空间结构类型）；自定义列表达式为受控 JS 风格子集（**不使用 eval**），可用函数 `attr / prop / qty / val / round / abs / min / max / if / concat / len / upper / lower / trim / number / int / contains`，支持算术、比较与逻辑运算；空值传播：算术得 null、比较得 false；单列求值失败降级为 null 并计入 `expression_errors`。

Quantities (QTO v1) derive from geometry bounding boxes — `volume / area / length / width / height` (model units, spatial structure types skipped); custom column expressions are a controlled JS-style subset (**no eval**) with functions `attr / prop / qty / val / round / abs / min / max / if / concat / len / upper / lower / trim / number / int / contains`, supporting arithmetic, comparison and logic; null propagation: arithmetic → null, comparison → false; a failing column degrades to null and counts into `expression_errors`.

### 报告渲染（M9）/ Report rendering (M9)

PDF 由 reportlab 生成（中文用内置 CID 字体 STSong-Light，无需外部字体文件），版式为封面摘要（标题 / 模型 / 生成时间 / 六项统计）+ 按严重度（错误 → 警告 → 提示）分组的问题清单表（分类规则 / 构件 / 关联构件 / 原因含判定链 / 位置 / 来源）；Excel 为双表：「摘要」（元信息 + 总体统计 + 按分类 / 来源统计）与「问题清单」（表头冻结 + 自动换行）。

PDF via reportlab (Chinese through the built-in CID font STSong-Light — no external font files), layout: cover summary (title / model / generated time / six statistics) + issue tables grouped by severity (error → warning → info) with rule category / element / related element / reason with decision chain / location / source; Excel has two sheets: "Summary" (metadata + overall + by-category / by-source stats) and "Issues" (frozen header + wrap text).

### 统一问题清单（L3）/ Unified issue list (L3)

规则违规与碰撞统一为 `issues`，每条含 `id/source/severity/category/title/element/related/location/actual/expected/reason/steps`，按严重度（error > warning > info）排序；`summary` 给出按级别 / 分类 / 来源的计数。

Rule violations and clashes unify into `issues`, each with `id/source/severity/category/title/element/related/location/actual/expected/reason/steps`, sorted by severity (error > warning > info); `summary` counts by severity / category / source.

### 持久化与原子写入 / Persistence & atomic writes

- 规则集：`.data/rulesets/*.json`，「先写 `*.tmp` 再重命名」原子写入；保存时校验结构（规则非空、`check.type` 合法、severity 合法、规则 id 不重复）
- 沟通问题：`.data/issues/<id>.json`（同一原子写入机制），快照存 `.data/issues/snapshots/<id>.png`
- 几何缓存：`.cache/geometry/*.kengeo`，按「模型路径 + 修改时间 + 大小」命中，重复请求不重新三角化；可用 `ARCHIKEN_CACHE_DIR` 改根目录
- Excel / PDF 导出：先写临时文件再替换目标文件，落盘到 `.data/exports/`
- 数据根目录可用环境变量 `ARCHIKEN_DATA_DIR` 覆盖；`path` 必须为绝对路径且位于允许的模型根目录内（默认 `corpus/`，可用 `ARCHIKEN_MODEL_ROOTS` 覆盖多个目录）

- Rulesets: `.data/rulesets/*.json`, atomic "write `*.tmp` then rename"; structural validation on save (non-empty rules, legal `check.type`, legal severity, unique rule ids)
- Issues: `.data/issues/<id>.json` (same atomic mechanism), snapshots in `.data/issues/snapshots/<id>.png`
- Geometry cache: `.cache/geometry/*.kengeo`, keyed by "model path + mtime + size" — repeated requests skip re-triangulation; root overridable via `ARCHIKEN_CACHE_DIR`
- Excel / PDF exports: temp-file-then-replace atomic writes into `.data/exports/`
- Data root overridable via `ARCHIKEN_DATA_DIR`; `path` must be absolute and inside an allowed model root (default `corpus/`, override with `ARCHIKEN_MODEL_ROOTS`)

### BCF 2.1 导出 / BCF 2.1 export

遵循 buildingSMART 开放标准：zip 根 `bcf.version` + 每主题 `<topic-guid>/markup.bcf`（Topic 属性携带标题 / 描述 / 状态 / 级别）+ 可选 `<topic-guid>/snapshot.png`；内部状态映射为 BCF 常用状态文本（open→OPEN、acknowledged→IN PROGRESS、resolved→CLOSED）。

Follows the buildingSMART open standard: zip root `bcf.version` + per-topic `<topic-guid>/markup.bcf` (Topic carries title / description / status / priority) + optional `<topic-guid>/snapshot.png`; internal statuses map to common BCF status text (open→OPEN, acknowledged→IN PROGRESS, resolved→CLOSED).

### Autorun 批量检查（M11，纯 API）/ Autorun batch checking (M11, API only)

任务持久化到 `.data/autorun/tasks/<id>.json`（原子写入）；每次运行生成自包含目录 `.data/autorun/runs/<run_id>/`（报告产物 + `run.json` manifest，含逐模型状态 / 问题数 / 产物清单），任务设 `output_dir` 时整份复制到 `<output_dir>/<run_id>/` 完成结果分发（共享盘 / 交付目录）；单模型失败不中断整批，运行记录永久保留。可用 `tools/server/smoke_test.py` 或任意 HTTP 客户端触发，适合命令行 / 计划任务等无人值守场景。

Tasks persist to `.data/autorun/tasks/<id>.json` (atomic write); each run creates a self-contained folder `.data/autorun/runs/<run_id>/` (report artifacts + `run.json` manifest with per-model status / issue counts / artifact list); with `output_dir` set, the whole folder is copied to `<output_dir>/<run_id>/` for result distribution (shared drive / delivery folder); a single model failure never aborts the batch; run records are kept permanently. Trigger via `tools/server/smoke_test.py` or any HTTP client — ideal for CLI / scheduled-task unattended scenarios.

---

## 九、界面架构（L4）/ Frontend Architecture (L4)

界面不直连内核，统一经 `src/services/transport.ts` 请求：

- **Electron 模式**：渲染进程通过预加载桥 `window.archiken.forward(spec)` 交主进程执行请求（`archiken:forward` IPC）。
- **浏览器开发模式**：通过 vite 代理 `/api/kernel` → `http://127.0.0.1:4319`、`/api/server` → `http://127.0.0.1:4318`。

浏览器模式需先启动内核与业务服务（见「单独运行各服务」），再打开 `http://localhost:5173/`。

The UI never talks to the kernel directly; everything goes through `src/services/transport.ts`:

- **Electron mode**: the renderer calls the preload bridge `window.archiken.forward(spec)`, executed by the main process (`archiken:forward` IPC).
- **Browser dev mode**: vite proxies `/api/kernel` → `http://127.0.0.1:4319` and `/api/server` → `http://127.0.0.1:4318`.

Browser mode requires the kernel and business service running first (see "Run services individually"), then open `http://localhost:5173/`.

| 目录 | 模块 | 说明 |
|---|---|---|
| `src/i18n/` | 中英双语框架 | 轻量 Context + 字典查表（无第三方依赖），默认中文，localStorage 持久化；词典按模块拆分（`zh/`、`en/`） |
| `src/services/transport.ts` | 统一传输层 | 按运行环境选择 IPC / vite 代理，统一错误提取 |
| `src/services/kernel.ts` | 内核客户端（L4 → L2） | summary / hierarchy / element / bboxes / mesh / rules / clash / clashMatrix / ids / federation / takeoff 的类型化封装 |
| `src/services/report.ts` | 报告客户端（L4 → L3） | `reportRun`（问题清单）、`reportHtml`（HTML 报告）、`reportExport`（PDF / Excel 导出） |
| `src/services/ruleset.ts` | 规则集客户端（L4 → L3） | `listRulesets / getRuleset / saveRuleset / deleteRuleset / runRuleset` |
| `src/services/issues.ts` | 沟通客户端（L4 → L3） | `issuesList / issuesGet / issueCreate / issueUpdate / issueDelete / issueComment / issueSnapshot / issuesImport / issueBcfExport` 类型化封装 |
| `src/viewer/scene.ts` | 3D 场景核心 | three.js 场景 / 透视 + 正交双相机（Z-up 轨道）/ 渲染循环 / 射线拾取（构件 + 标记）/ 标准视角 / 相机飞行动画 |
| `src/viewer/model.ts` | 模型图层 | 包围盒 → 彩色盒体，按专业色（缺失时回退 IFC 类型）着色，材质按「玻璃 + 专业 + 颜色」分组缓存，选中高亮，构件中心查询；按专业分组实现「透视外壳」淡化（关深度写入）；真实网格支持显色模式切换（专业配色 / IFC 原生色，无样式构件回退类型色），玻璃构件（窗 / 门 / 玻璃材质面组）自动半透明、框料实心 |
| `src/viewer/Viewer.tsx` | 3D 视图组件 | 承载画布、重建图层、点击选中回调；集成剖切控制器与标记图层，经 ViewerHandle 对外暴露视图能力（剖切多轴 / 滑杆 / 拖拽、透视外壳淡化，切换图层后自动回填）；显色模式 prop 驱动专业色 / IFC 原生色切换 |
| `src/viewer/views/clipping.ts` | 剖切控制 | renderer.clippingPlanes 三轴向平面，+/− 侧切方向，模型包围盒实时取切面范围 |
| `src/viewer/views/markers.ts` | 3D 标记图层 | 球体图钉 + canvas 文字标签（按模型尺度缩放），增删 / 拾取 / 定位 |
| `src/viewer/views/viewpoints.ts` | 视角与演示 | 7 个 Z-up 标准视角预设、ViewState 存取、命名演示视角 localStorage 持久化 |
| `src/model-tree/ModelSourcePanel.tsx` | 模型源面板 | 多模型源列表（增删）、路径输入、快捷候选 |
| `src/model-tree/FederationTree.tsx` | 融合模型树 | 融合根 → 模型节点 → 空间层级，显示专业徽章与构件级专业分布 |
| `src/ruleset-editor/RulesetEditor.tsx` | 规则集编辑器 | 悬浮层：规则集列表、新建/选择/保存/删除、合规预设一键添加、模板快速添加、校验与运行 |
| `src/ruleset-editor/RuleEditor.tsx` | 单条规则编辑表单 | 按 `check.type` 分派字段（property / intersection / clearance / headroom / dimension / duplicate） |
| `src/clash/ClashMatrix.tsx` | 冲突矩阵面板 | 悬浮层：硬碰撞 / 间隙 / 净空分类与容差、忽略同专业、运行矩阵、专业矩阵表与问题清单 |
| `src/ids/IdsEditor.tsx` | IDS 编辑器 | 悬浮层：IDS XML 编辑 / 载入示例 / 解析预览 / 导出 XML / 对模型校验并查看逐规范报告 |
| `src/takeoff/TakeoffPanel.tsx` | 信息提取面板 | 悬浮层：固定字段与建议列说明、自定义计算列编辑（受控表达式）、运行提取、逐构件结果与合计、导出 Excel |
| `src/communication/CommunicationPanel.tsx` | 沟通面板 | 悬浮层：导入检查结果生成问题清单、新建问题（可关联选中构件）、状态 / 级别过滤、BCF 2.1 导出 |
| `src/communication/IssueDetail.tsx` | 沟通问题详情 | 状态 / 级别调整、评论列表与发送、附加 3D 视图快照、定位构件、删除 |
| `src/report/ReportPanel.tsx` | 报告面板 | 悬浮层：摘要统计 + 问题清单预览（前 100 条，构件点击联动 3D），重新生成 / HTML 预览 / 导出 PDF / 导出 Excel |
| `src/views/ViewToolbar.tsx` | 视图工具条 | 固定占位在 3D 视图上方（非浮层、零遮挡）：透视 / 平面切换、七个标准视角一键到位、「透视外壳」淡化 + 透明度滑杆、X / Y / Z 剖切一键启用 + 实时滑杆 + 翻转 +「拖动」锁定 3D 内拖拽 + 全部清除 |
| `src/views/ViewPanel.tsx` | 视图系统面板 | 手风琴浮动卡片（默认全折叠、头部可拖拽移位，只放低频项）：检查结果标记与手动标记、演示视角保存与顺序播放 |

| Directory | Module | Description |
|---|---|---|
| `src/i18n/` | Bilingual framework | Lightweight Context + dictionary lookup (no third-party deps), Chinese default, localStorage persistence; dictionaries split per module (`zh/`, `en/`) |
| `src/services/transport.ts` | Unified transport | Picks IPC / vite proxy per runtime, unified error extraction |
| `src/services/kernel.ts` | Kernel client (L4 → L2) | Typed wrappers: summary / hierarchy / element / bboxes / mesh / rules / clash / clashMatrix / ids / federation / takeoff |
| `src/services/report.ts` | Report client (L4 → L3) | `reportRun` (issue list), `reportHtml` (HTML report), `reportExport` (PDF / Excel) |
| `src/services/ruleset.ts` | Ruleset client (L4 → L3) | `listRulesets / getRuleset / saveRuleset / deleteRuleset / runRuleset` |
| `src/services/issues.ts` | Issues client (L4 → L3) | `issuesList / issuesGet / issueCreate / issueUpdate / issueDelete / issueComment / issueSnapshot / issuesImport / issueBcfExport` |
| `src/viewer/scene.ts` | 3D scene core | three.js scene / perspective + orthographic dual cameras (Z-up orbit) / render loop / ray picking (elements + markers) / standard views / camera fly animations |
| `src/viewer/model.ts` | Model layer | Bboxes → colored boxes by discipline (IFC type fallback); materials cached per "glass + discipline + color" group, selection highlight, element center lookup; per-discipline groups drive the "X-Ray Shell" fade (depth writes off); true-mesh layer supports color-mode switching (discipline palette / native IFC colors, type-color fallback for unstyled elements) with glazing (windows / doors / glass panels) auto-translucent by type or material name (frames stay solid) |
| `src/viewer/Viewer.tsx` | 3D view component | Hosts canvas, rebuilds layers, click-select callback; integrates clipping controller & marker layer, exposes view capabilities via ViewerHandle (multi-axis section / slider / drag, X-Ray Shell fade reapplied after layer rebuild); a color-mode prop drives the discipline / native IFC color switch |
| `src/viewer/views/clipping.ts` | Section clipping | renderer.clippingPlanes on three axes, ± side direction, live range from model bbox |
| `src/viewer/views/markers.ts` | 3D marker layer | Sphere pins + canvas text labels (scaled to model), add/remove/pick/locate |
| `src/viewer/views/viewpoints.ts` | Views & presentation | 7 Z-up standard view presets, ViewState capture/apply, named viewpoints in localStorage |
| `src/model-tree/ModelSourcePanel.tsx` | Model source panel | Multi-source list (add/remove), path input, quick suggestions |
| `src/model-tree/FederationTree.tsx` | Federated tree | Federation root → model nodes → spatial hierarchy, discipline badges & per-element distribution |
| `src/ruleset-editor/RulesetEditor.tsx` | Ruleset editor | Overlay: ruleset list, create/select/save/delete, compliance presets, template quick-add, validate & run |
| `src/ruleset-editor/RuleEditor.tsx` | Single-rule form | Dispatches fields by `check.type` (property / intersection / clearance / headroom / dimension / duplicate) |
| `src/clash/ClashMatrix.tsx` | Clash matrix panel | Overlay: hard / gap / clearance with tolerances, ignore same discipline, run matrix, discipline table & issue list |
| `src/ids/IdsEditor.tsx` | IDS editor | Overlay: IDS XML editing / example loading / parse preview / XML export / validation with per-spec report |
| `src/takeoff/TakeoffPanel.tsx` | Takeoff panel | Overlay: fixed fields & suggested columns, custom computed columns (controlled expressions), run, per-element results & totals, Excel export |
| `src/communication/CommunicationPanel.tsx` | Communication panel | Overlay: import check results as issues, create issue (linked to selection), status / severity filters, BCF 2.1 export |
| `src/communication/IssueDetail.tsx` | Issue detail | Status / severity adjustment, comments, attach 3D snapshot, locate element, delete |
| `src/report/ReportPanel.tsx` | Report panel | Overlay: summary stats + issue preview (first 100, click to select in 3D), regenerate / HTML preview / PDF / Excel export |
| `src/views/ViewToolbar.tsx` | View toolbar | Docked above the 3D view (in-layout, zero occlusion): perspective / plan toggle, seven standard views, "X-Ray Shell" fade with opacity slider, X / Y / Z sections with axis click + live slider + flip + "Drag" lock for in-3D dragging + clear all |
| `src/views/ViewPanel.tsx` | View system panel | Accordion floating card (collapsed by default, draggable by header, low-frequency items only): result & manual markers, viewpoint save & auto-play |

3D 视图当前用构件包围盒（`/geometry/bboxes`）绘制简化盒体以验证交互链路；逐构件三角网格真实显示与剖切截面填充（cap）列入后续阶段。

The 3D view currently draws simplified boxes from element bboxes (`/geometry/bboxes`) to validate the interaction chain; true per-element triangle meshes and section cap filling are scheduled for a later phase.

---

## 十、国际化（中英双语）/ Internationalization

- **使用**：顶栏右侧 `EN / 中` 按钮一键切换；默认中文，选择持久化到本机 localStorage（键 `archiken:lang`）。
- **实现**：`src/i18n/` 轻量框架（React Context + 字典查表，无第三方依赖）；`useT()` 返回 `t(key, vars?)`，缺键回退中文；词典按模块拆分于 `src/i18n/zh/` 与 `src/i18n/en/`，新增界面文案时在对应模块词典各加一条同名键。
- **范围**：L4 界面静态文案 + 服务端数据文案（规则模板名、专业名、预设名、问题原因、修复建议等）。
- **服务端 i18n**：双语字段以 `_en` 后缀存英文、原字段为中文；内核端点（`/rules/templates`、`/rules/presets`、`/rules/run`、`/federation/disciplines`、`/federation/merge`、`/clash/matrix`）与 L3 报告链路（`/report/run`、`/report/html`、`/report/export`、`/ruleset/run`）均接受 `lang=zh|en`（查询参数或请求体），缺省回退中文，界面按当前语言自动透传。

- **Usage**: click `EN / 中` at the right end of the top bar; Chinese is the default and the choice persists in localStorage (key `archiken:lang`).
- **Implementation**: lightweight framework in `src/i18n/` (React Context + dictionary lookup, no third-party deps); `useT()` returns `t(key, vars?)` with Chinese as the missing-key fallback; dictionaries are split per module under `src/i18n/zh/` and `src/i18n/en/` — add the same key to both when introducing new UI text.
- **Scope**: static L4 UI text + server-returned strings (rule template names, discipline names, preset names, issue reasons, remediation steps, etc.).
- **Server-side i18n**: bilingual fields store English under an `_en` suffix with Chinese in the base field; kernel endpoints (`/rules/templates`, `/rules/presets`, `/rules/run`, `/federation/disciplines`, `/federation/merge`, `/clash/matrix`) and the L3 report chain (`/report/run`, `/report/html`, `/report/export`, `/ruleset/run`) all accept `lang=zh|en` (query param or body), falling back to Chinese when omitted; the UI passes the current language automatically.

---

## 十一、开发规范 / Engineering Conventions

1. 单模块文件 ≤ 500 行；> 800 行必须拆分，子模块同规则；单一模块只做一件事。
2. 每次代码修改追加记录到 `debug_log_x.md`（时间 / 模块名 / 变更简述 / 备注）；`debug_log_1.md` 接近 800 行时新开 `debug_log_2.md`。
3. 结构改动同步更新本 `readme.md`。
4. 代码精简无冗余、可直接运行。
5. 代码更新自动提交 git。

1. A module file stays ≤ 500 lines; > 800 lines must be split into submodules (same rule applies); one module does one thing.
2. Every code change appends a record to `debug_log_x.md` (time / module / summary / notes); when `debug_log_1.md` nears 800 lines, start `debug_log_2.md`.
3. Structural changes update this `readme.md`.
4. Code must be lean, free of redundancy and directly runnable.
5. Code changes are committed to git automatically.

---

## 十二、云端部署与版本同步 / Cloud Deployment & Version Sync

同一份代码库同时支持**单机版**与**网页版**，运行模式由构建开关 `VITE_APP_MODE` 区分，不做分支分叉：

| 模式 | 值 | 传输方式 |
|---|---|---|
| 桌面单机版 | `electron` | Electron IPC（`window.archiken.forward`） |
| 本机网页调试 | `web` | Vite 开发代理 |
| 云端网页版 | `cloud` | 同源 `/api/*`，由宝塔 Nginx 反代到 L3 |

The same codebase serves both the **standalone desktop** and the **web** edition; the running mode is selected by the build switch `VITE_APP_MODE` without forking branches:

| Mode | Value | Transport |
|---|---|---|
| Desktop standalone | `electron` | Electron IPC (`window.archiken.forward`) |
| Local web dev | `web` | Vite dev proxy |
| Cloud web | `cloud` | Same-origin `/api/*`, reverse-proxied by BT Nginx to L3 |

### 架构 / Architecture

```
宝塔 Nginx（HTTPS 证书 + 反代 + 静态资源托管）
  ├─ 静态资源  → /www/wwwroot/archiken-web（dist 产物）
  ├─ /api/*    → 127.0.0.1:4318  archiken-server（Node L3 容器）
  └─ /kernel/* → 127.0.0.1:4319  archiken-kernel（Python L2 容器）
       两个容器共享数据卷 archiken-data:/data（上传模型 / 规则集 / BCF / 报告 / 几何缓存）
```

两个后端容器只绑定 `127.0.0.1`，公网无法直连，入口统一收敛到宝塔 Nginx。

The two backend containers bind only to `127.0.0.1`, so they are unreachable from the public internet; all traffic funnels through BT Nginx.

### 部署文件 / Deployment files

| 文件 | 用途 |
|---|---|
| `deploy/docker-compose.yml` | 双容器编排（内核 + 业务服务），共享数据卷 |
| `deploy/Dockerfile.kernel` | L2 内核镜像（Python 3.11，多阶段无编译工具链） |
| `deploy/Dockerfile.server` | L3 业务镜像（Node 20，多阶段：编译期 → 仅运行时依赖） |
| `deploy/.env` | 构建标识 / 端口 / API Key 等环境变量 |
| `deploy/build-deploy-zip.ps1` | **一键打包**：构建 cloud 前端 + 组装后端 → `archiken-deploy.zip` |
| `deploy/DEPLOY_ON_BT_PANEL.md` | 宝塔面板五步上线指南（随 zip 分发） |
| `deploy/版本同步规范.md` | 单一主干策略、构建模式切换、漂移预警与校验清单 |
| `deploy/更新操作SOP.md` | 备份 → 构建发布 → 双端验证 → 回滚预案 |

### 上线流程（宝塔面板）/ Go-live (BT panel)

1. 阿里云安全组放行 **80 / 443**（公网 IP `47.93.210.248`）。
2. 把 `archiken-deploy.zip` 上传到服务器 `/www/wwwroot/` 并解压。
3. 终端执行：`cd /www/wwwroot/archiken` → `docker compose build` → `docker compose up -d`。
4. 宝塔「网站」新建站点，站点根目录指向 `archiken-web`，粘贴反代块（`/api/*` 与 `/kernel/*`），开启「访问限制 → 用户认证」设置访客密码。
5. 申请 Let's Encrypt 证书并开启「强制 HTTPS」。

### API Key 鉴权 / API-key auth

L3 支持 `ARCHIKEN_API_KEY` 环境变量鉴权（未设置则本地放行，**不影响单机版**）。**公网部署默认不启用**：前端页面 JS 任何人可下载，把 Key 写进前端等于公开密钥。网页版的访问保护改由宝塔 Nginx 的**基础认证（Basic Auth）**承担，凭据不落前端。如需启用 API Key，在 `deploy/.env` 填 `ARCHIKEN_API_KEY=<值>` 后重新 `docker compose up -d`，并在前端构建时通过 `VITE_ARCHIKEN_API_KEY` 注入（仅适用于内网可信场景）。

L3 supports `ARCHIKEN_API_KEY`-based auth (when unset, local requests pass — **the standalone edition is unaffected**). **Public deployments leave it off by default**: front-end JS is publicly downloadable, so embedding the key there is equivalent to publishing it. Web-edition access control is instead handled by BT Nginx **Basic Auth**, keeping the credential out of the front end.

### 版本一致性锚点 / Version anchors

更新后三处构建标识必须一致，用于确认单机版与网页版同源同版：

1. 前端产物名 `dist/assets/index-<hash>.js` 的 `<hash>`；
2. 云端 `https://<域名>/healthz` 返回 JSON 的 `build` 字段；
3. 打包输出的 `BUILD_INFO.txt`（含构建 ID、前端 hash、git 短哈希）。

After each update the following three build markers must match, proving both editions come from the same source and version:

1. the `<hash>` in the front-end artifact name `dist/assets/index-<hash>.js`;
2. the `build` field of the cloud `https://<domain>/healthz` JSON response;
3. `BUILD_INFO.txt` produced by the packaging script (build ID, front-end hash, short git hash).

详细规则与操作步骤见 [deploy/版本同步规范.md](deploy/版本同步规范.md) 与 [deploy/更新操作SOP.md](deploy/更新操作SOP.md)。

See [deploy/版本同步规范.md](deploy/版本同步规范.md) and [deploy/更新操作SOP.md](deploy/更新操作SOP.md) for detailed rules and procedures.
