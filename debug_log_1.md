# ArchiKen 变更记录（debug_log_1）

> 格式：时间 | 模块名 | 变更简述 | 备注
> 本文件接近 800 行时，新建 `debug_log_2.md` 继续记录。

---

| 时间 | 模块名 | 变更简述 | 备注 |
|---|---|---|---|
| 2026-10-13 | 全项目 | 初始化工程脚手架：Electron 主进程、React 渲染进程、Python 内核服务、Koa 业务服务四层骨架 | 对应计划工作包 1.7；四层目录与架构设计 L1–L4 一致 |
| 2026-10-13 | 根配置 | 新增 `package.json`、三个 `tsconfig`（渲染/主进程/服务）、`vite.config.ts`、`index.html`、`.gitignore` | 主进程编译至 `dist-electron`，渲染进程输出至 `dist` |
| 2026-10-13 | electron/main.ts | 主进程：创建主窗口、拉起并守护 Python 内核进程、暴露 `kernel:health` IPC | 内核默认端口 4319，仅绑定 127.0.0.1 |
| 2026-10-13 | electron/preload.ts | 通过 contextBridge 暴露白名单方法 `kernelHealth()` | 保持 contextIsolation，禁用 nodeIntegration |
| 2026-10-13 | src/ | 渲染进程：React 应用外壳 + 内核连通性自检按钮 + 基础样式 | 仅用于验证链路，不含业务功能 |
| 2026-10-13 | kernel/main.py | L2 内核骨架：FastAPI 应用 + `/health` 端点，支持 `--host/--port` | 后续接入 IfcOpenShell 解析、几何、碰撞、规则求值 |
| 2026-10-13 | server/index.ts | L3 业务服务骨架：Koa 应用 + `/health` 端点 | 后续接入项目管理、规则集、任务编排 |
| 2026-10-13 | 文档 | 新增 `readme.md`（用途/模块清单/使用说明）与 `docs/模块清单.md` | 遵循「新建项目自动生成 readme」规范 |
| 2026-10-13 | corpus/ | 新增语料库目录：`README.md`（命名与覆盖规范）、`manifest.json`（清单索引） | 对应计划工作包 1.1；覆盖矩阵 4 版本 × 4 导出方 × 4 规模档 |
| 2026-10-13 | tools/corpus | 新增 `check_manifest.py`：清单格式校验 + 覆盖矩阵与覆盖率统计 | 支持 `--check-files` 校验样本文件存在性；实测输出 0/64 覆盖率 |
| 2026-10-13 | docs | 新增 `功能矩阵与行为规格.md`：M1–M11 模块矩阵、规则模板条目模板、交付物与验收对照、合规红线 | 对应计划工作包 1.2 与阶段一交付物 1 |
| 2026-10-13 | 根配置 | `.gitignore` 增加 `corpus/samples/` | 样本本体不入 git，仅提交清单 |
| 2026-10-13 | 依赖 | 安装 IfcOpenShell 0.9.0（`ifcopenshell-0.9.0-py314-none-win_amd64.whl`）；`kernel/requirements.txt` 追加 `ifcopenshell>=0.9,<1.0` | 对应计划工作包 2.2；Python 3.14 官方 wheel |
| 2026-10-13 | tools/corpus/make_smoke_ifc.py | 新增冒烟模型生成器：用 ifcopenshell.api 构建自建 IFC4 模型（Site/Building/Storey + 2 面墙 + Pset_WallCommon），输出 `corpus/samples/_smoke/smoke-ifc4.ifc` | 合规自建数据，不依赖第三方样本；实测 schema=IFC4，构件 5 |
| 2026-10-13 | kernel/app/config.py | 新增内核配置：允许扩展名、模型缓存容量、模型根目录（环境变量 `ACHIAUDIT_MODEL_ROOTS` 覆盖） | 默认根目录为 `corpus/` |
| 2026-10-13 | kernel/app/ifc/loader.py | 新增 IFC 加载与缓存层：路径校验（绝对路径 / 存在 / 扩展名 / 根目录白名单）+ LRU 缓存，保证同输入同输出 | 缓存键 = 路径 + mtime + 大小 |
| 2026-10-13 | kernel/app/ifc/summary.py | 新增模型摘要：schema、导出方、长度单位与换算系数、地理参考（IfcMapConversion）、构件统计 | 换算系数用 `ifcopenshell.util.unit.calculate_unit_scale` |
| 2026-10-13 | kernel/app/ifc/hierarchy.py | 新增空间层级树：手工遍历 `IsDecomposedBy` / `ContainsElements`，版本无关 | 节点含 guid/name/ifc_type/depth/element_total/elements_by_type/children |
| 2026-10-13 | kernel/app/ifc/properties.py | 新增构件分页列表与单构件属性提取（类型对象 / 所在空间 / 属性集） | 用 `util.element.get_type/get_container/get_psets` |
| 2026-10-13 | kernel/app/routes/ifc.py | 新增 4 个端点：`/ifc/summary`、`/ifc/hierarchy`、`/ifc/elements`、`/ifc/elements/{guid}`，统一错误映射 | FileNotFound→404 / Permission→403 / ValueError→400 / KeyError→404 |
| 2026-10-13 | kernel/main.py | 内核升至 0.2.0：挂载 ifc 路由，保留 `/health` | 解析服务已接入 |
| 2026-10-13 | tools/kernel/smoke_test.py | 新增端到端冒烟测试脚本（urllib 无第三方依赖）：依次校验 health/summary/hierarchy/elements/elements/{guid} | 参数 `--base-url`、`--model`；实测四端点全部通过 |
| 2026-10-13 | docs | `模块清单.md`：IFC 解析服务目录改为 `kernel/app/ifc/` 并标注「已实现」；新增「内核冒烟测试 tools/kernel/」行 | 结构改动同步 |
| 2026-10-13 | readme.md | 模块清单表中 `kernel/`、`tools/` 状态更新；使用说明补充 IFC 解析服务端点与冒烟测试命令 | 遵循「结构改动同步更新 readme」 |
| 2026-10-13 | kernel/app/config.py | 新增 `geometry_cache_dir()`：几何缓存目录，可用环境变量 `ACHIAUDIT_CACHE_DIR` 覆盖 | 默认 `.cache/geometry` |
| 2026-10-13 | kernel/app/geometry/cache.py | 新增 `.achigeo` 二进制缓存读写：magic + 条目数 + 每构件 guid/类型/包围盒/顶点/索引，原子写入 | 按模型指纹（路径+mtime+大小）命名，损坏时返回 None |
| 2026-10-13 | kernel/app/geometry/extract.py | 新增几何提取：IfcOpenShell 三角化（世界坐标）→ 包围盒；`load_or_extract` 带缓存 | 实测 2 面墙各 12 三角面，包围盒与世界坐标一致；二次请求命中缓存 |
| 2026-10-13 | kernel/app/routes/deps.py | 新增路由公共依赖 `open_model`：统一错误映射 404/403/400 | 消除 ifc/geometry 两处重复实现 |
| 2026-10-13 | kernel/app/routes/ifc.py | 改用 `deps.open_model`，移除本地 `_open` | 行为不变 |
| 2026-10-13 | kernel/app/routes/geometry.py | 新增 3 个端点：`/geometry/bboxes`、`/geometry/elements/{guid}`（`mesh` 可选）、`/geometry/stats` | bboxes 返回中心/尺寸/三角面数，供碰撞粗筛 |
| 2026-10-13 | kernel/main.py | 内核升至 0.3.0：挂载 geometry 路由 | 几何内核服务已接入 |
| 2026-10-13 | tools/kernel/smoke_test.py | 冒烟测试扩展几何端点：stats / bboxes / mesh；标题改为「解析与几何服务」 | 端到端实测全部通过 |
| 2026-10-13 | 根配置 | `.gitignore` 增加 `.cache/` | 几何缓存入 git 不入版本库 |
| 2026-10-13 | docs | `模块清单.md`：几何内核服务标注「已实现」，内核冒烟测试说明补几何验证 | 结构改动同步 |
| 2026-10-13 | kernel/app/geometry/cache.py | 顶点精度由 f32 改为 f64，magic 升为 `ACGEO\x02` | 三角求交对精度敏感，避免舍入误判 |
| 2026-10-13 | kernel/app/clash/geommath.py | 新增三角形求交数学：非共面用交线区间法、共面用 2D 裁剪求重叠区；返回真实接触点 | 共面零面积（仅共边/共点）不算相交；合成用例全部符合预期 |
| 2026-10-13 | kernel/app/clash/broadphase.py | 新增宽相位：按 X 轴排序扫描的 AABB 候选对筛选 | 复杂度由 O(n²) 降至接近 O(n·k) |
| 2026-10-13 | kernel/app/clash/engine.py | 新增硬碰撞引擎：候选对逐三角形求交，返回接触点/相交三角形数/统计 | 单对设测试与命中上限，防超长响应 |
| 2026-10-13 | kernel/app/routes/clash.py | 新增端点 `/clash/run`（支持 `ifc_type_a/ifc_type_b/max_clashes`） | 复用几何缓存结果 |
| 2026-10-13 | kernel/main.py | 内核升至 0.4.0：挂载 clash 路由 | 硬碰撞引擎已接入 |
| 2026-10-13 | tools/corpus/make_smoke_ifc.py | 冒烟模型扩至 4 面墙：面接触、体积相交、完全分离三种布置 | 供碰撞验证；构件数由 5 增至 7 |
| 2026-10-13 | tools/kernel/smoke_test.py | 冒烟测试扩展碰撞端点；标题改为「解析/几何/碰撞服务」 | 端到端实测：候选对 2、碰撞 2、接触点准确 |
| 2026-10-13 | readme.md / docs | 内核模块状态补硬碰撞引擎；端点表补 `/clash/run`；模块清单标注「已实现」 | 结构改动同步 |
| 2026-10-13 | 计划文档 / docs | 总计划升 V0.2：新增 §2.5「云端部署路线」；选型表补 6 项云端选型；阶段四/五新增 4.9/4.10/5.8 工作包、交付物与验收；决策 D5 修订并新增 D7/D8/A6；验证步骤补「云端可复跑」；`docs/模块清单.md` 新增「第四阶段」章节 | 遵循「结构改动同步更新文档」；明确「桌面为主、云端为辅」；本轮不改任何代码 |
| 2026-10-13 | kernel/app/rules/dsl.py | 新增规则 DSL v1 定义与校验：必填字段、检查类型（property/intersection/clearance/duplicate）、severity 枚举、id 去重 | 返回规范化副本；缺字段/非法类型抛 RuleError |
| 2026-10-13 | kernel/app/rules/operators.py | 新增算子：比较（== != > >= < <= in contains startswith endswith matches exists not_exists）与单位换算（model/m/cm/mm） | 纯函数；bool 不参与数值比较 |
| 2026-10-13 | kernel/app/rules/selector.py | 新增构件选择器：按 IFC 类型与 where 条件（Pset 属性 / 构件属性）筛选目标构件 | 未知 IFC 类型映射为 ValueError→400 |
| 2026-10-13 | kernel/app/rules/checks.py | 新增四类检查：属性比较、相交（复用硬碰撞引擎）、包围盒净距、重复构件判定（尺寸+中心容差） | 均返回违规项与原因链 steps |
| 2026-10-13 | kernel/app/rules/evaluator.py | 新增求值编排：选择目标→执行检查→按需加载几何缓存→汇总统计与通过/未通过计数 | 纯属性规则不触发三角化 |
| 2026-10-13 | kernel/app/rules/templates.py | 新增 5 个内置模板：跨专业碰撞 / 门最小净宽 / 梁板净空 / 重复构件 / 管道最小间距 | 支持按 id 取子集，未知 id 报错 |
| 2026-10-13 | kernel/app/routes/rules.py | 新增端点：`GET /rules/templates`、`GET /rules/run`、`POST /rules/run`（自定义规则，优先于 rule_ids） | RuleError→400；内置子集用逗号分隔 rule_ids |
| 2026-10-13 | kernel/main.py | 内核升至 0.5.0：挂载 rules 路由 | 简化规则引擎已接入 |
| 2026-10-13 | tools/corpus/make_smoke_ifc.py | 冒烟模型新增规则组构件：门（宽 0.7m）、楼板+梁（垂直净空 0.5m）、两根重合立柱、两根相邻管道、一根穿墙风管 | 构件数由 7 增至 15；均远离墙体簇，仅风管刻意与 墙-004 相交 |
| 2026-10-13 | tools/kernel/smoke_test.py | 冒烟测试扩展规则端点：templates + run，逐规则打印违规数与原因 | 端到端实测 5 个模板各命中 1 条违规 |
| 2026-10-13 | kernel/app/rules/checks.py | 修复：属性检查对非数值算子（contains/matches/exists）误做单位换算，触发 400 | 仅数值算子做 unit 换算；实测 POST 自定义规则通过 |
| 2026-10-13 | readme.md / docs | 内核模块状态补规则引擎；端点表补 `/rules/*`；`docs/模块清单.md` 简化规则引擎标注「已实现」 | 结构改动同步 |
| 2026-10-13 | server/router.ts | 新增极简路由（路径 `:param` 匹配）与 JSON body 读取；仅依赖 koa | 未引入 koa-router/koa-bodyparser；非法 JSON→400 |
| 2026-10-13 | server/kernel-client.ts | 新增内核客户端：health / rules-run / clash-run；统一错误映射（连接失败→503，非 2xx 透传内核 detail） | 基址 `ACHIAUDIT_KERNEL_URL`，默认 127.0.0.1:4319 |
| 2026-10-13 | server/report/aggregate.ts | 新增结果汇总：规则违规 + 碰撞统一为 `issues`（含 source/severity/category/element/related/location/reason/steps）与统计 | 按严重度排序；issue id 稳定可复现 |
| 2026-10-13 | server/report/html.ts | 新增 HTML 报告 v1 渲染（自包含内联 CSS，含级别徽标与判定链） | 无外部依赖 |
| 2026-10-13 | server/routes/report.ts | 新增端点：GET/POST `/report/run`、GET `/report/html`（支持 `rule_ids`、`include_clash`） | 缺 path→400，非法 JSON→400 |
| 2026-10-13 | server/index.ts | L3 改造为路由式服务并升 0.2.0：挂载 `/health` 与报告端点 | 路由 / 客户端 / 汇总 / 渲染分层，单一模块只做一件事 |
| 2026-10-13 | server/report/html.ts | 修复：issueRow 模板误引用自身变量 related，改用 issue.related，通过类型检查 | `tsc -p tsconfig.server.json` 通过 |
| 2026-10-13 | readme.md / docs | L3 状态改「已实现（v1）」；readme 新增「报告服务（L3）」端点表与运行说明；模块清单标注已实现 | 端到端实测：9 问题（5 规则 + 4 碰撞），HTML 报告约 5.7KB |
| 2026-10-13 | 依赖 | 安装 `three@^0.186.1` 与 `@types/three`（devDependency） | 3D 视图模块基础库 |
| 2026-10-13 | src/services/transport.ts | 新增统一传输层：Electron 走 IPC 桥 `achiaudit.forward`，浏览器走 vite 代理 `/api/kernel|/api/server`；统一按 content-type 解析与错误提取 | 单一职责；渲染进程各客户端共用 |
| 2026-10-13 | src/services/kernel.ts | 新增内核客户端（L4 → L2）：summary / hierarchy / element / bboxes / stats / mesh / rules / clash 类型化封装 | 与内核响应字段一一对应 |
| 2026-10-13 | src/services/report.ts | 新增报告客户端（L4 → L3）：`reportRun`（问题清单）与 `reportHtml`（HTML 文本） | 复用 L3 `/report/*` 端点 |
| 2026-10-13 | src/types.d.ts | 桥接面由 `kernelHealth()` 改为通用 `forward(spec)`；新增构建期常量 `__PROJECT_ROOT__` 声明 | 主进程统一转发，白名单收敛为单入口 |
| 2026-10-13 | electron/main.ts | 主进程新增内核(4319)/业务服务(4318)基址表与 `achiaudit:forward` IPC，按目标转发并返回原始响应 | 移除原 `kernel:health` 专用通道 |
| 2026-10-13 | electron/preload.ts | contextBridge 暴露白名单方法 `forward(spec)` | 保持 contextIsolation、禁用 nodeIntegration |
| 2026-10-13 | src/viewer/scene.ts | 新增 3D 场景核心：three.js 场景/透视相机/轨道控制/环境光/ResizeObserver/渲染循环/射线拾取（拖动不触发） | 只做显示与交互，不感知业务数据 |
| 2026-10-13 | src/viewer/model.ts | 新增模型图层：包围盒 → BoxGeometry 盒体，按 IFC 类型稳定着色，共享材质 + Box3Helper 选中高亮 | 拾取对象以 userData.guid 关联构件 |
| 2026-10-13 | src/viewer/Viewer.tsx | 新增 3D 视图组件：承载画布、随构件列表重建图层并自动取景、选中高亮、点击回调 | 选中回调用 ref 避免闭包失效 |
| 2026-10-13 | src/viewer/ModelTree.tsx | 新增模型树：递归渲染空间层级，节点可展开/折叠，显示类型与构件数 | 用 `/ifc/hierarchy` 数据 |
| 2026-10-13 | src/App.tsx | 改造为三栏工作台：模型树 + 摘要 / 3D 视图 / 构件属性 + 问题清单；加载模型 / 运行检查 / 预览报告 | 默认加载内置冒烟模型（`__PROJECT_ROOT__` 拼接） |
| 2026-10-13 | src/styles.css | 重写为三栏布局与面板/树/属性/问题卡片样式 | 顶部工具条 + 全高工作区 |
| 2026-10-13 | vite.config.ts | 新增 `server.proxy`（`/api/kernel`→4319、`/api/server`→4318）与 `define.__PROJECT_ROOT__` | 浏览器开发期免 CORS，模拟 Electron 请求面 |
| 2026-10-13 | readme.md / docs | L4 两行状态改「已实现（v1）」；readme 新增「界面（L4）」章节与模块表、更新开发模式说明；模块清单标注两模块已实现 | 结构改动同步 |
| 2026-10-13 | 验证 | `npm run typecheck` 三配置全过；`npm run build`（渲染进程 + 主进程）构建通过；浏览器端到端：加载 15 构件（12 有几何）、5 规则 + 4 碰撞共 9 问题、点击拾取与属性/问题联动正常、控制台无 error | 渲染产物约 700KB（three 占主要体积），暂未做代码分割 |
| 2026-10-13 | kernel/app/federation/discipline.py | 新增专业定义与三级自动映射规则：7 个专业（建筑/结构/暖通/给排水/电气/场地/其他，含中文名与颜色），规则优先级「构件命名 → IFC 类型 → 所属模型」 | 名称规则顺序敏感（hvac 先于 plumbing）；模型级推断可被构件级分类覆盖 |
| 2026-10-13 | kernel/app/federation/merge.py | 新增多模型融合核心：坐标归一（单位换算到米 + IfcMapConversion 平移偏移）、专业聚合桶、GUID 冲突用「模型序号:guid」去重 | 元素项含 uid/guid/name/ifc_type/model/discipline/color/bbox/center/size/triangle_count |
| 2026-10-13 | kernel/app/federation/tree.py | 新增融合模型树：融合根 → 每模型一个 model 节点（含专业推断与构件总数）→ 模型空间层级 | 复用 hierarchy.build_hierarchy 并注入专业分类回调 |
| 2026-10-13 | kernel/app/ifc/hierarchy.py | 增加可选 `classify` 回调，节点新增 `elements_by_discipline` 字段 | 不传回调时行为与 `ifc/hierarchy` 响应保持不变 |
| 2026-10-13 | kernel/app/routes/federation.py | 新增端点：`GET /federation/disciplines`、`POST /federation/merge`、`POST /federation/tree`、`GET /federation/merge?paths=` | 复用 deps.open_model 统一错误映射 |
| 2026-10-13 | kernel/main.py | 内核升至 0.6.0：挂载 federation 路由 | 模型加载与融合服务已接入 |
| 2026-10-13 | tools/corpus/make_smoke_ifc.py | 新增第二模型源 `smoke-structural-ifc4.ifc`（结构柱/梁/基础 + 暖通风管，文件名含 structural → 模型专业=结构） | 复用空间层级搭建；实测 8 构件 |
| 2026-10-13 | tools/kernel/smoke_test.py | 冒烟测试扩展融合段：专业规则表 + 两模型融合 + 融合树专业分布打印 | 端到端实测：模型 2、构件 23、有几何 17、专业 6、GUID 冲突 0 |
| 2026-10-13 | src/services/kernel.ts | 新增 federation 类型与客户端：`federationDisciplines` / `federationMerge` / `federationToBboxItems`；`BboxItem` 增加 `discipline?` / `color?` | 与内核 /federation/* 响应字段一一对应 |
| 2026-10-13 | src/viewer/model.ts | 材质着色键由 `ifc_type` 改为 `color ?? ifc_type` | 有专业色时按专业着色，缺失回退 IFC 类型 |
| 2026-10-13 | src/model-tree/ModelSourcePanel.tsx | 新建模型源面板：列表增删、路径输入、快捷候选 | 多模型源管理 |
| 2026-10-13 | src/model-tree/FederationTree.tsx | 新建融合模型树：递归渲染 model / 空间节点，显示专业徽章与构件级专业分布标签 | 默认展开模型节点与前两层 |
| 2026-10-13 | src/App.tsx | 改造为多模型源工作台：默认加载建筑 + 结构两模型，`loadFederation` 调融合接口并映射为 bbox 项；检查/报告以第一个模型源为输入 | 问题点击按 `模型序号:guid` 反查并定位 |
| 2026-10-13 | src/styles.css | 追加模型源面板、专业分类图例、融合树专业标签等样式 | 结构改动同步 |
| 2026-10-13 | src/viewer/ModelTree.tsx | 删除旧单模型空间树（已被融合树替代） | 已确认无其他引用 |
| 2026-10-13 | readme.md / docs | readme 补模型融合模块状态、`/federation/*` 端点表、`src/model-tree/` 模块表与多模型源使用说明；模块清单 M1 标注「已实现」；功能矩阵表 1 M1 行填写 | 结构改动同步 |
| 2026-10-13 | 验证 | 内核 0.6.0 健康；`smoke_test.py` 融合段全过（专业聚合示例：结构 9 / 建筑 6 / 暖通 2 / 给排水 2 / 场地 2 / 其他 2）；`npm run typecheck` 三配置全过；`npm run build` 构建通过 | 浏览器端到端 UI 验证本轮未执行（见备注） |
| 2026-10-13 | kernel/app/rules/templates.py | 内置模板由 5 个扩充为 12 个：窗防火等级必填 / 门无障碍标识 / 外墙防火等级必填 / 构件命名规范 / 风管楼板净空 / 墙窗几何相交 / 管道重复建模 | 覆盖属性存在性、布尔等值、where 过滤、正则匹配、净距、相交、重复七类语义 |
| 2026-10-13 | kernel/app/routes/rules.py | 新增端点 `POST /rules/validate`：请求体 `{rules}`，合法返回规范化规则、非法返回 400 + 原因 | 不需模型即可校验规则定义，供 L4 编辑器「校验」按钮调用 |
| 2026-10-13 | kernel/main.py | 内核升至 0.7.0：docstring 与版本同步（规则 DSL v1 + 12 个内置模板 + 规则校验） | 简化规则引擎 M3 增强完成 |
| 2026-10-13 | server/ruleset/model.ts | 新建规则集数据模型与结构校验：`normalizeRuleset`（name 非空、规则非空、`check.type` 合法、severity 合法、rule id 不重复），`RulesetError`（status=400） | L3 规则集管理基础 |
| 2026-10-13 | server/ruleset/store.ts | 新建文件型持久化：`.data/rulesets/*.json`（`ACHIAUDIT_DATA_DIR` 可覆盖），原子写入（`*.tmp`→rename）；list/get/save/delete | 与几何缓存同用原子写策略，避免并发读写损坏 |
| 2026-10-13 | server/routes/ruleset.ts | 新建规则集端点：`/ruleset/list`、`/ruleset/get`、`/ruleset/save`（新建 201 / 覆盖 200）、`/ruleset/delete`、`/ruleset/run`（规则 + 碰撞 → 统一问题清单） | 复用 report 汇总；缺失 id→400、不存在→404 |
| 2026-10-13 | server/kernel-client.ts | `runRules(path, ruleIds?, rules?)` 增加第三参数（body 优先 `rules`）；新增 `validateRules(rules)` 调 `POST /rules/validate` | 支持以规则集自定义规则运行 |
| 2026-10-13 | server/index.ts | L3 升级至 0.3.0：挂载 5 个 ruleset 路由 | 规则集管理服务已接入 |
| 2026-10-13 | src/services/kernel.ts | 追加规则模板与校验段：`ruleTemplates()`、`validateRules(rules)` 与 `RuleSpec` / `CheckType` 类型 | 与内核 DSL v1 字段对齐 |
| 2026-10-13 | src/services/ruleset.ts | 新建规则集客户端（L4 → L3）：`listRulesets / getRuleset / saveRuleset / deleteRuleset / runRuleset` | 全部 target=server |
| 2026-10-13 | src/ruleset-editor/RuleEditor.tsx | 新建单条规则编辑表单：按 `check.type` 分派字段（property/intersection/clearance/duplicate），含类型列表解析与值解析助手 | 约 246 行，单一职责 |
| 2026-10-13 | src/ruleset-editor/RulesetEditor.tsx | 新建规则集编辑器悬浮层：列表（新建/选择/删除）、规则卡片增删、内置模板快速添加、保存 / 校验 / 运行 | 运行结果经 `onReport` 回填问题清单 |
| 2026-10-13 | src/ruleset-editor/RuleEditor.tsx | 修复类型错误：`setCheck` 补 `as RuleSpec['check']` 断言；JSX 文本中 `{actual}` 等改为字符串包裹 | `npm run typecheck` 通过 |
| 2026-10-13 | src/App.tsx | 顶栏新增「规则集」按钮与 `editorOpen` 状态；`</main>` 后按需挂载 `RulesetEditor` | 与既有「运行检查 / 预览报告」并列 |
| 2026-10-13 | src/styles.css | 追加规则集编辑器样式：`.editor-overlay/.editor-dialog/.editor-*`、`.rule-card/.rule-grid`、`.notice-bar`、`button.tiny.danger` | 结构改动同步 |
| 2026-10-13 | .gitignore | 新增 `.data/`（规则集数据），与 `.cache/` 同属构建产物 | 不入 git |
| 2026-10-13 | tools/kernel/smoke_test.py | 冒烟测试新增 `POST /rules/validate` 校验段并打印规范化规则数 | 端到端实测：12 模板、校验通过 |
| 2026-10-13 | tools/server/smoke_test.py | 新建 L3 规则集端到端冒烟（urllib）：health → save → get → list → run → delete | 实测：save id=ruleset-*（2 规则）、run 返回 `规则=2 未通过=1 碰撞=4 问题共=5` |
| 2026-10-13 | readme.md / docs | readme 补 `/rules/*`、`/ruleset/*` 端点表、`src/services/ruleset.ts` 与 `src/ruleset-editor/*` 模块表、「规则集」按钮说明、`.data/` 与 `tools/server/` 目录；模块清单 M3 / L3 / 横切工具更新；功能矩阵表 1 M3 行填写、表 2 录入 12 个内置模板条目 | 结构改动同步 |
| 2026-10-13 | 验证 | 内核 0.7.0 健康、`smoke_test.py` 全过（规则运行 `规则=12 通过=5 未通过=7 违规合计=9`）；L3 0.3.0 健康、`tools/server/smoke_test.py` 全过；`python -m compileall -q kernel tools` OK；`npm run typecheck` OK；`npm run build` OK（45 模块，dist CSS 7.70 kB / JS 712.95 kB） | 浏览器端到端 UI 验证因环境无 browser 工具未执行，建议本机手测「规则集」 |
| 2026-10-13 | kernel/app/clash/geommath.py | 新增最小距离计算：`point_triangle_distance` / `segment_segment_distance` / `tri_tri_distance`（不相交取顶点—面、边—边最小值，相交返 0） | M4 间隙/净空窄相位；离线自测平行三角距 0.05、相交返 0 均正确 |
| 2026-10-13 | kernel/app/clash/broadphase.py | 新增 `bbox_overlap_expanded` 与 `near_pairs(entries, expand)`：包围盒按容差膨胀取候选对，用于间隙/净空邻近判定 | `expand=0` 等价原 `candidate_pairs` |
| 2026-10-13 | kernel/app/clash/engine.py | `_triangles` 提升为公开 `triangles`，供冲突矩阵复用三角形拆分 | 硬碰撞行为不变 |
| 2026-10-13 | kernel/app/clash/ignore.py | 新建忽略规则模块：同构件、同专业（可选）、类型对 / 专业对 / 构件 GUID 对忽略（两侧可互换） | 纯函数；对应功能矩阵 M4 忽略规则 |
| 2026-10-13 | kernel/app/clash/classify.py | 新建碰撞分类模块：`classify_pair` 按 hard（相交）> gap（≤间隙容差）> clearance（≤净空）分类，含三角形求交与最小距离扫描、提前退出 | 单文件专注分类 |
| 2026-10-13 | kernel/app/clash/matrix.py | 新建冲突矩阵模块：构件专业分类 → 分桶 → 宽相位膨胀候选 → 忽略过滤 → 分类 → 按「专业对」单元格汇总（依专业定义顺序稳定排序） | 幂等；阈值以模型单位为准 |
| 2026-10-13 | kernel/app/routes/clash.py | 新增 `POST /clash/matrix`：请求 `{path, hard?, gap_mm?, clearance_mm?, ignore_same_discipline?, ignore?, cells?, max_clashes?}`，阈值 mm→模型单位换算；保留原 `GET /clash/run` | 单模型专业两两对检 |
| 2026-10-13 | kernel/main.py | L2 内核升级至 0.8.0；模块说明补「冲突矩阵：硬/间隙/净空分类与忽略规则」 | 与 rules 0.7.0 增量兼容 |
| 2026-10-13 | src/services/kernel.ts | 追加 M4 段：`clashMatrix(path, options)` 与 `ClashMatrixResponse/Cell/Item/Ref/Mode` 类型 | target=kernel，POST `/clash/matrix` |
| 2026-10-13 | src/clash/ClashMatrix.tsx | 新建冲突矩阵面板悬浮层：硬/间隙/净空勾选与容差、忽略同专业开关、运行、专业矩阵表 + 问题清单（点击联动 3D 选中） | 单文件，单一职责 |
| 2026-10-13 | src/App.tsx | 顶栏新增「碰撞矩阵」按钮与 `clashOpen` 状态；挂载 `ClashMatrix`（`onSelect` 回填 3D 选中） | 与「规则集」并列 |
| 2026-10-13 | src/styles.css | 追加冲突矩阵样式：`.clash-tools/.clash-toggle/.clash-num/.clash-body/.clash-matrix/.cell-*`、`.dot.hard/.gap/.clearance`、`.issue.clash-*` | 结构改动同步 |
| 2026-10-13 | tools/kernel/smoke_test.py | 冒烟新增 `POST /clash/matrix` 两段：默认矩阵（忽略同专业，硬碰撞 1）与全开矩阵（gap_mm=60/clearance_mm=600、不忽略同专业，硬 4/间隙 1/净空 1） | 端到端实测通过 |
| 2026-10-13 | readme.md / docs | readme 补 `POST /clash/matrix` 端点、L2/L4 模块与「碰撞矩阵」按钮说明、`src/clash/ClashMatrix.tsx` 模块表；模块清单 M4 行与基础碰撞引擎行更新；功能矩阵表 1 M4 行填写 | 结构改动同步 |
| 2026-10-13 | 验证 | 内核 0.8.0 健康、`smoke_test.py` 全过（默认矩阵 硬碰撞 1/忽略 3；全开矩阵 硬 4/间隙 1/净空 1）；`python -m compileall -q kernel tools` OK；`npm run typecheck` OK；`npm run build` OK（46 模块，dist CSS 8.87 kB / JS 717.69 kB） | 浏览器端到端 UI 验证因环境无 browser 工具未执行，建议本机手测「碰撞矩阵」 |
| 2026-10-13 | 产品命名 | 确定中文名「筑审通」（产品代号 AchiAudit）；同步至 readme 标题/简介、界面顶栏品牌、项目记忆 | 仅命名与文案，无业务逻辑变更 |
| 2026-10-13 | 依赖 | `kernel/requirements.txt` 新增 `ifctester>=0.9,<1.0`（IfcOpenShell 官方 IDS 实现，pip 包） | 已实测安装 0.9.0；原 wheel 不含 ifctester，需单独安装 |
| 2026-10-13 | kernel/app/ids/spec.py | 新建 IDS 文档读写：XML/文件 → Ids 对象（`load_xml/load_file`）、`to_xml`、`info`、`describe`（编辑器结构预览） | 非法 XML 统一抛 `IdsError` |
| 2026-10-13 | kernel/app/ids/validate.py | 新建 IDS 校验执行：复用 ifctester `reporter.Json` 判定语义，实体引用压缩为 GUID 摘要，输出 `{status, totals, specifications[...]}` | 每实体清单默认上限 100 条 |
| 2026-10-13 | kernel/app/ids/example.py | 新建内置示例 IDS（3 规范：墙体命名 / 防火等级 EI60 / 隔声等级必填），供界面载入与冒烟 | 自建、符合 IDS 1.0 schema；实测 2 通过 / 1 未通过 |
| 2026-10-13 | kernel/app/ids/__init__.py | 新增 ids 子包说明（spec / validate / example 三子模块职责） | 单一职责 |
| 2026-10-13 | kernel/app/routes/ids.py | 新增 3 端点：`GET /ids/example`、`POST /ids/parse`、`POST /ids/validate`；IdsError→400、缺文件→404 | 校验复用 `deps.open_model` 错误映射 |
| 2026-10-13 | kernel/main.py | L2 内核升级至 0.9.0：挂载 ids 路由，模块说明补 IDS 校验 | 与 0.8.0 增量兼容 |
| 2026-10-13 | src/services/kernel.ts | 追加 M7 段：`idsExample / idsParse / idsValidate` 与 IDS 结果类型 | target=kernel |
| 2026-10-13 | src/ids/IdsEditor.tsx | 新建 IDS 编辑器悬浮层：IDS XML 编辑 / 载入示例 / 解析预览 / 导出 XML / 隐藏跳过项 / 运行校验；结构预览 + 逐规范校验报告（失败构件点击联动 3D 选中） | 单文件，单一职责 |
| 2026-10-13 | src/App.tsx | 顶栏品牌改为「筑审通 / AchiAudit」；新增「IDS 校验」按钮与 `idsOpen` 状态；挂载 `IdsEditor` | 与「碰撞矩阵」并列 |
| 2026-10-13 | src/styles.css | 追加 IDS 编辑器样式：`.ids-tools/.ids-body/.ids-editor/.ids-xml/.ids-side/.ids-preview/.ids-specs/.ids-result/.ids-status/.ids-entities` 等 | 结构改动同步 |
| 2026-10-13 | tools/kernel/smoke_test.py | 冒烟新增 IDS 段（example → parse → validate），逐规范打印通过情况与失败构件 | 端到端实测：规范 3、通过 2、未通过 1、检查通过率 66% |
| 2026-10-13 | readme.md / docs | readme 补标题中文名、`/ids/*` 端点表、L2/L4 模块与「IDS 校验」按钮说明、`src/ids/IdsEditor.tsx` 模块表与目录说明；模块清单 L2 行与 M7 行更新；功能矩阵表 1 M7 行填写 | 结构改动同步 |
| 2026-10-13 | 验证 | 内核 0.9.0 健康、`smoke_test.py` 全过（IDS 规范 3 / 通过 2 / 未通过 1 / 检查通过率 66%）；`python -m compileall -q kernel tools` OK；`npm run typecheck` OK；`npm run build` OK（47 模块，dist CSS 10.96 kB / JS 723.48 kB） | 浏览器端到端 UI 验证因环境无 browser 工具未执行，建议本机手测「IDS 校验」 |
| 2026-10-13 | kernel/app/rules/dsl.py | M5：检查类型新增 `headroom`（净高）与 `dimension`（净尺寸） | 与既有 property/intersection/clearance/duplicate 并列 |
| 2026-10-13 | kernel/app/rules/checks.py | M5：新增 `headroom_check`（空间底面→投影范围内最低遮挡构件底面的垂直净空，无遮挡则退回自身高度）与 `dimension_check`（包围盒指定轴向尺寸，`axis: min` 取水平两轴较小值） | 复用几何缓存 bbox；轴向非法抛 ValueError→400 |
| 2026-10-13 | kernel/app/rules/evaluator.py | M5：新增 headroom / dimension 两类检查的分派分支 | headroom 会按需加载几何缓存 |
| 2026-10-13 | kernel/app/rules/templates/ | M5：`templates.py` 拆分为子包 —— `common.py`（原 12 条通用模板）、`compliance.py`（新增 12 条合规模板）、`__init__.py`（聚合 + `select_by_category`） | 单一模块只做一件事；原 `templates.py` 已删除 |
| 2026-10-13 | kernel/app/rules/templates/compliance.py | M5：新增 12 条合规专用模板，分类为「无障碍」（门净宽 / 无障碍标识 / 通道净宽 / 门洞净高）、「净高」（房间 / 走道 / 梁下净高）、「消防」（墙体与防火门等级 / 自闭器 / 喷淋净距 / 疏散宽度） | 与 presets 分类一一对应 |
| 2026-10-13 | kernel/app/rules/presets.py | M5：新增合规预设（无障碍 / 净高 / 消防 / 全套），按分类展开为规则，供一键套用 | 预设只声明分类，规则由 `select_by_category` 展开 |
| 2026-10-13 | kernel/app/routes/rules.py | M5：新增 `GET /rules/presets` 端点 | 返回含展开规则的预设清单 |
| 2026-10-13 | kernel/main.py | L2 内核升级至 0.10.0：模块说明补合规性检查（M5） | 与 0.9.0 增量兼容 |
| 2026-10-13 | src/services/kernel.ts | M5：`CheckType` 扩充 headroom / dimension；新增合规预设类型 `RulePreset` 与客户端 `rulePresets()` | target=kernel |
| 2026-10-13 | src/ruleset-editor/RuleEditor.tsx | M5：检查类型下拉补「净高 / 净尺寸」，新增对应字段（遮挡类型 / 最小净高 / 轴向 / 最小净尺寸）与默认值 | 按 check.type 分派字段 |
| 2026-10-13 | src/ruleset-editor/RulesetEditor.tsx | M5：新增「从合规预设添加」下拉与「添加预设」按钮，一键追加整组规则（自动去重 id） | 加载时并行拉取规则集 / 模板 / 预设 |
| 2026-10-13 | tools/corpus/make_smoke_ifc.py | M5：冒烟模型新增两个空间（房间-SP1 位于梁下方净高不足、走道-SP2 净宽不足净高充足）；空间按空间分解挂载楼层 | 构件数由 15 增至 17 |
| 2026-10-13 | tools/kernel/smoke_test.py | M5：冒烟新增合规段（`/rules/presets` + 按预设 rule_ids 运行），逐规则打印分类与违规 | 标题补「合规」 |
| 2026-10-13 | readme.md / docs | readme：L2 行与端点表补 `/rules/presets`（模板 24 个）、DSL 说明补 headroom/dimension、L4 规则集编辑器与 RuleEditor 说明；模块清单 L2 行、规则引擎行、M5 行更新；功能矩阵表 1 M5 行填写、表 2 追加 12 条合规模板条目 | 结构改动同步 |
| 2026-10-13 | 验证 | M5 验证：内核 0.10.0 健康、`smoke_test.py` 全过（合规预设 4 个；合规全套 12 规则 6 通过 / 6 未通过 / 违规 6；净高违规 1、通道净宽违规 1）；`python -m compileall -q kernel tools` OK；`npm run typecheck` OK；`npm run build` OK（47 模块，dist CSS 10.96 kB / JS 725.36 kB） | 浏览器端到端 UI 验证因环境无 browser 工具未执行，建议本机手测「规则集 → 从合规预设添加」 |
| 2026-10-13 | kernel/app/takeoff/expr.py | M6：新增受控表达式模块（JS 风格语法子集），词法分析 + 递归下降求值，禁用 eval；支持 attr/prop/qty/val 等 13 个函数、算术 / 比较 / 逻辑运算与空值传播；补 FUNCTIONS_DOC 函数说明表 | JS 引擎（quickjs / py_mini_racer）不可用，改为自建受控表达式 |
| 2026-10-13 | kernel/app/takeoff/columns.py | M6：新增列定义模块——固定字段（guid / name / ifc_type / container）、5 个内置建议列、自定义列规范化校验（key 唯一、expr 语法合法、禁与固定字段重名） | ColumnError → 路由 400 |
| 2026-10-13 | kernel/app/takeoff/quantities.py | M6：新增工程量推导（QTO v1）——由包围盒尺寸推导 volume / area / length / width / height，round 6 位 | 不解析 IfcElementQuantity，后续版本接入 |
| 2026-10-13 | kernel/app/takeoff/extract.py | M6：新增提取主流程——遍历 IfcProduct（跳过空间结构），复用几何缓存 bbox，逐构件按列序求值（values 支持引用前列），psets 惰性读取；单表达式错误降级 null 并计数 | 数值列自动合计 |
| 2026-10-13 | kernel/app/takeoff/export.py | M6：新增 Excel 导出——openpyxl 写 xlsx（表头 + 数据行 + 合计行），先写 .tmp 再 replace 原子替换；导出目录 `.data/exports/` | requirements.txt 增 openpyxl>=3.1,<4.0 |
| 2026-10-13 | kernel/app/config.py | M6：新增 `exports_dir()`（ACHIAUDIT_DATA_DIR / .data 下 exports） | 与 ruleset 数据目录约定一致 |
| 2026-10-13 | kernel/app/routes/takeoff.py | M6：新增信息提取路由 5 端点——GET /takeoff/columns、POST /takeoff/run、POST /takeoff/export、GET /takeoff/exports；ColumnError → 400 | 挂载于 kernel/main.py |
| 2026-10-13 | kernel/main.py | M6：挂载 takeoff 路由，服务版本 0.10.0 → 0.11.0，docstring 补信息提取 | — |
| 2026-10-13 | src/services/kernel.ts | M6：追加 TakeoffColumn / TakeoffRunResponse / TakeoffExportResponse 等类型与 takeoffColumns / takeoffRun / takeoffExport 客户端函数 | — |
| 2026-10-13 | src/takeoff/TakeoffPanel.tsx | M6：新增信息提取面板——固定字段 / 建议列 / 函数说明展示，自定义列增删，运行提取结果表（含合计行），导出 Excel 并显示文件路径 | 悬浮层复用 editor-overlay / editor-dialog 样式 |
| 2026-10-13 | src/App.tsx | M6：顶栏新增「信息提取」按钮与面板渲染（以第一个模型源为输入） | — |
| 2026-10-13 | src/styles.css | M6：追加 editor-actions、takeoff 面板与结果表样式 | — |
| 2026-10-13 | tools/kernel/smoke_test.py | M6：冒烟新增信息提取段（/takeoff/columns、/takeoff/run 三列含 qty / 算术 / if+contains、/takeoff/export 校验文件非空） | — |
| 2026-10-13 | 验证 | M6 验证：内核 0.11.0 健康、`smoke_test.py` 全过（提取 12 行、表达式错误 0、合计 volume=13.209、Excel 导出 5591 字节）；`python -m compileall -q kernel tools` OK；`npm run typecheck` OK；`npm run build` OK（48 模块） | UI 端到端未做浏览器验证，建议本机手测「信息提取」面板 |
| 2026-10-13 | readme.md / docs | readme：目录树、L2 / L4 模块行、使用说明「信息提取」段、端点表补 /takeoff/* 与表达式说明、L4 表补 TakeoffPanel；模块清单 M6 行、功能矩阵表 1 M6 行填写 | 结构改动同步 |
| 2026-10-13 | 全局改名 | 产品英文标识 AchiAudit → ArchiKen：package.json 包名与描述、内核服务名 archiken-kernel、L3 archiken-server、env 前缀 ARCHIKEN_*、IPC 通道 archiken:forward、预加载桥 window.archiken、IDS 导出文件名、HTML 报告标题、顶栏文案、计划文档（.trae 两份文档改名 ArchiKen_*） | 中文名「筑审通」不变；磁盘目录名不变；debug_log 历史行保留原标识以存真 |
| 2026-10-13 | kernel/app/geometry/cache.py | 几何缓存扩展名 .achigeo → .kengeo，MAGIC 由 ACGEO 改 KENGE | 旧缓存自然失效，首次访问重建 |
| 2026-10-13 | src/App.tsx + src/styles.css | 顶栏品牌区新增 logo（内联 SVG：建筑轮廓 + 对勾，单色 #2f6feb）与 .brand/.logo 样式 | 简洁图案，体现模型质量审查 |
| 2026-10-13 | tools/corpus/make_smoke_ifc.py | 冒烟模型工程名改为「ArchiKen 冒烟工程 / ArchiKen 冒烟结构工程」并重新生成模型 | — |
| 2026-10-13 | 验证 | 改名后验证：内核 archiken-kernel v0.11.0 与业务服务 archiken-server v0.3.0 健康；`smoke_test.py`（内核 + 业务）全过；`compileall` OK；`npm run typecheck` OK；`npm run build` OK | — |
| 2026-10-13 | server/bcf/model.ts | M8：新增沟通问题数据模型——类型（CommIssue / 评论 / 摘要）与创建、更新补丁的规范化校验 | 校验错误统一 IssueError(status=400) |
| 2026-10-13 | server/bcf/store.ts | M8：新增问题持久化——`.data/issues/<id>.json` 原子写入、快照 PNG 存取、删除联动清理 | 复用 ARCHIKEN_DATA_DIR 约定 |
| 2026-10-13 | server/bcf/service.ts | M8：新增问题业务逻辑——创建 / 更新 / 评论 / 快照（dataURL→PNG）/ 从检查报告导入（标题+构件 guid 去重）/ BCF 导出编排 | 导出 zip 原子写入 `.data/exports/` |
| 2026-10-13 | server/bcf/bcf.ts | M8：新增 BCF 2.1 打包——`bcf.version` + `<guid>/markup.bcf`（Topic 属性 + Comment 元素）+ 可选 `snapshot.png` | jszip；状态映射 OPEN / IN PROGRESS / CLOSED |
| 2026-10-13 | server/routes/issue.ts + server/index.ts | M8：新增 9 个 /issues/* 端点并注册，L3 版本 0.3.0 → 0.4.0 | list / get / create / update / delete / comment / snapshot / import / bcf.export |
| 2026-10-13 | package.json | 新增 jszip 依赖（BCF 导出用） | — |
| 2026-10-13 | tools/server/smoke_test.py | M8：冒烟新增沟通段（创建 / 评论 / 快照 / 更新 / 导入 / 过滤列表 / BCF 导出 / 二次导入去重断言 / 删除），收尾语改为「业务服务冒烟测试通过」 | — |
| 2026-10-13 | src/services/issues.ts | M8：新增沟通客户端（L4 → L3）类型化封装（9 个函数） | — |
| 2026-10-13 | src/communication/* | M8：新增沟通面板——问题清单与状态 / 级别过滤、新建问题（可关联选中构件）、详情（状态 / 级别调整、评论、快照、定位构件、删除）、导入检查结果与 BCF 导出；独立 communication.css | 悬浮层复用 editor-overlay / editor-dialog 样式 |
| 2026-10-13 | src/viewer/scene.ts + Viewer.tsx | M8：3D 视图支持截图——WebGLRenderer 开启 preserveDrawingBuffer 并新增 capture()；Viewer 改 forwardRef 暴露 ViewerHandle.capture | 快照为当前视角 PNG dataURL |
| 2026-10-13 | src/App.tsx | M8：顶栏新增「沟通」按钮与面板渲染（传入选中构件 / 视图截图 / 构件联动回调），引入 communication.css | — |
| 2026-10-13 | 验证 | M8 验证：L3 冒烟全过（archiken-server v0.4.0；导入 18 条、二次导入去重 0、BCF 导出 19 主题 13821 字节）；`npm run typecheck` OK；`npm run build` OK（52 模块） | UI 端到端未做浏览器验证，建议本机手测「沟通」面板 |
| 2026-10-13 | readme.md / docs | readme：目录树（src / .data）、模块清单 L3 / L4 行、使用说明「沟通」段、L3 端点表补 /issues/*、持久化说明、L4 模块表补沟通三行；模块清单 M8 行、功能矩阵表 1 M8 行填写 | 结构改动同步 |
| 2026-10-13 | kernel/app/report/render_pdf.py（新增） | M9：PDF 报告渲染——reportlab + 内置 CID 中文字体 STSong-Light（免外部字体），封面摘要（标题/模型/时间/六项统计）+ 按严重度分组问题清单表（含判定链/位置），tmp 文件原子替换 | reportlab 5.0.1 已装并验证 cid-font |
| 2026-10-13 | kernel/app/report/render_xlsx.py（新增） | M9：Excel 报告渲染——openpyxl 双表（摘要：元信息+总体/分类/来源统计；问题清单：11 列、表头冻结+自动换行、按严重度排序），原子写入 | 与 M6 导出同款原子写机制 |
| 2026-10-13 | kernel/app/routes/report.py（新增）+ kernel/main.py | M9：新增 POST /report/export（收统一问题清单 JSON → 渲染 pdf/xlsx 到 .data/exports/report-<时间戳>）、GET /report/exports；内核版本 0.11.0 → 0.12.0，注册 report_router | report 结构缺 summary/issues 返回 400 |
| 2026-10-13 | kernel/requirements.txt | 新增依赖 reportlab>=4.0（M9 PDF 渲染） | — |
| 2026-10-13 | server/kernel-client.ts + server/report/export.ts（新增） | M9：内核客户端新增 exportReport；L3 新增导出编排 exportReportFile（runRules+runClash → buildReport → 内核渲染） | 复用既有 buildReport，无重复汇总逻辑 |
| 2026-10-13 | server/routes/report.ts + server/index.ts | M9：新增 POST /report/export 端点（body {path, format, rule_ids?, include_clash?, title?}）；业务服务版本 0.4.0 → 0.5.0 | — |
| 2026-10-13 | src/services/report.ts | M9：新增 reportExport 客户端（L4 → L3 POST /report/export，返回文件信息） | — |
| 2026-10-13 | src/report/ReportPanel.tsx + report.css（新增） | M9：报告面板——摘要统计卡（总数/错误/警告/提示/碰撞/未通过规则）、问题清单预览表（前 100 条、构件点击联动 3D）、重新生成 / HTML 预览 / 导出 PDF / 导出 Excel，导出成功显示文件路径 | 复用 editor-overlay 弹层模式与 badge 样式 |
| 2026-10-13 | src/App.tsx | M9：顶栏「预览报告」改为「报告」打开报告面板（移除 openReport 内联逻辑，HTML 预览移入面板）；引入 report.css | — |
| 2026-10-13 | tools/kernel/smoke_test.py + tools/server/smoke_test.py | M9 冒烟段：内核侧合成 2 条问题直测 /report/export（PDF 头 %PDF-、xlsx 头 PK 校验 + exports 列表断言）；业务侧真实模型全链路导出（19 条问题 PDF 8446B / xlsx 8648B） | — |
| 2026-10-13 | 验证 | M9 验证：`python -m compileall -q kernel tools` OK；内核 0.12.0 + 业务 0.5.0 健康；内核冒烟全过；server 冒烟全过；`npm run typecheck` OK；`npm run build` OK | UI 端到端未做浏览器验证，建议本机手测「报告」面板 |
| 2026-10-13 | readme.md / docs | readme：模块清单 L2/L3/L4 行、使用说明「报告」段、L2 端点表补 /report/export+/report/exports 与 M9 渲染说明、L3 端点表补 /report/export、L4 模块表补 ReportPanel 与 reportExport；模块清单 M9 行、功能矩阵表 1 M9 行填写 | 结构改动同步 |
| 2026-10-13 | src/viewer/views/clipping.ts（新增） | M10：剖切控制器——renderer.clippingPlanes 三轴向（x/y/z）平面，setRangeProvider 从模型包围盒取范围，setClip(axis, enabled, side:'plus'/'minus', position?) 控制保留侧与切面位置，每轴最多一个激活平面，getState / clear / dispose | plus=从正轴端切（Plane normal -轴、constant -pos），minus 反之 |
| 2026-10-13 | src/viewer/views/markers.ts（新增） | M10：3D 标记图层——共享球体几何 + 按颜色共享材质（renderOrder 10）、canvas roundRect 白底彩边文字 Sprite 标签（renderOrder 11）；add/remove/get/list/clear、pickObjects 供射线拾取、setWorldScale 按模型尺度缩放 | id 去重（先删后加）；默认色 #7c3aed |
| 2026-10-13 | src/viewer/views/viewpoints.ts（新增） | M10：视角定义与演示——ViewMode（perspective/orthographic）、7 个 Z-up PresetName 预设与 presetPlacement（顶/底视 up 用 +Y 防退化）、ViewState/SavedView 类型；loadViews/saveViews/createSavedView 经 localStorage（key archiken:views:<模型文件名>）按模型隔离 | — |
| 2026-10-13 | src/viewer/scene.ts（重写） | M10：ViewerCore 扩展——相机 up 改 Z-up；透视 + 正交双相机（activeCamera/viewMode/getViewMode），setMode 切换时复制位置/朝向/near/far 并重建 OrbitControls；applyPreset + frameObject 记录 fitCenter/fitRadius；getViewState；flyTo（保持视线方向）/flyToState 相机补间（easeInOutCubic，播放期间禁用轨道）；onMarkerPick + setMarkerTargets，点击拾取标记优先于构件；resize 同步正交 frustum | 新增字段 controlsTarget，勿重复声明；capture/dispose 保留 |
| 2026-10-13 | src/viewer/model.ts | M10：ModelLayer 接口与实现新增 centerOf(guid) 返回构件 mesh 中心（供无坐标问题落标记） | — |
| 2026-10-13 | src/viewer/Viewer.tsx（重写） | M10：集成 ClippingController 与 MarkerLayer（随图层重建设置 rangeProvider 与世界尺度，卸载置 null）；ViewerHandle 扩展至 18 个方法（模式/预设/视角状态/飞行/剖切/标记/focusMarker/focusPosition/getElementCenter）；新增 onMarkerPick prop | — |
| 2026-10-13 | src/views/ViewPanel.tsx + view.css（新增） | M10：视图悬浮面板四段——视角（透视/平面 + 7 预设）、剖切（轴向/侧/启用/滑杆/清除）、3D 标记（reportRun 一键载入按严重度 error/warning/info 配色，location 优先否则构件中心；手动标记选中构件；列表与 3D 拾取双向定位联动构件）、演示视角（命名保存/飞行跳转/3.2s 顺序播放/删除）；pickedMarker 带 nonce 支持同标记重复点击 | 411 行，独立 view.css |
| 2026-10-13 | src/App.tsx | M10：顶栏「报告」后新增「视图」按钮（无模型禁用）；Viewer 传 onMarkerPick（{id, nonce} 状态）；渲染 ViewPanel（selectedGuid 取 detail.guid，onSelect 走 selectElement(`0:${guid}`)）；引入 view.css | — |
| 2026-10-13 | 验证 | M10 验证：`npm run typecheck` 初报 6 错（camera 基类无 near/far——收紧为 PerspectiveCamera｜OrthographicCamera 联合类型；flyToState handle 签名补 duration?），修复后 OK；`npm run build` OK（chunk 体积为既有警告） | 纯 L4 无后端改动，未跑 Python 冒烟；UI 端到端未做浏览器验证，建议本机 npm run dev 手测视图面板 |
| 2026-10-13 | readme.md / docs | readme：目录树 src 注释、模块清单 L4 行、使用说明「视图」段、L4 模块表 scene/model/Viewer 三行改写 + clipping/markers/viewpoints/ViewPanel 四行、结尾阶段说明（剖切与视图已落地）；模块清单 3D 视图行与 M10 行、功能矩阵 M10 行填写 | 结构改动同步 |
| 2026-10-14 | server/autorun/model.ts（新增） | M11：Autorun 数据模型——任务（models/ruleset_id/include_clash/formats[pdf/xlsx/html/json]/output_dir）、运行记录与摘要类型、normalizeTask 结构校验 | 115 行 |
| 2026-10-14 | server/autorun/store.ts（新增） | M11：持久化——任务 `.data/autorun/tasks/<id>.json` 原子写 CRUD；运行记录自包含目录 `.data/autorun/runs/<run_id>/run.json`，listRuns 可按任务过滤 | 168 行 |
| 2026-10-14 | server/autorun/runner.ts（新增） | M11：批量执行器——规则集解析（ruleset_id 缺失→404）→逐模型顺序跑规则+可选碰撞→buildReport→按格式产出（pdf/xlsx 复制内核 M9 导出并改名 <模型basename>、html 用 L3 renderReportHtml、json 直写）→run.json→可选 output_dir 整份分发；单模型失败不中断，分发失败仅标注不抹结果 | 135 行 |
| 2026-10-14 | server/routes/autorun.ts（新增）+ server/index.ts | M11：新增 7 个 /autorun/* 端点并注册（list/get/save/delete/run/runs/run.get），L3 版本 0.5.0 → 0.6.0 | run 为同步执行，返回完整运行记录 |
| 2026-10-14 | tools/server/smoke_test.py | M11：冒烟新增 Autorun 段（建任务含 output_dir → 批量运行 → 断言 PDF 头 / JSON 与运行记录一致 / run.json 存在 / 分发目录副本存在 → runs 列表与详情 → 删除任务） | — |
| 2026-10-14 | 验证 | M11 验证：`npm run typecheck` 三套 OK；业务服务重启 0.6.0 健康；server 冒烟全过（M11 段：19 问题、产物 2、分发校验通过）；`npm run build` OK | 纯 L3 无 L2/L4 改动；内核 0.12.0 未动 |
| 2026-10-14 | readme.md / docs | readme：模块清单 L3 行、.data 目录注释、L3 端点表补 7 个 /autorun/*、持久化说明补 Autorun 段（纯 API 无界面 + 无人值守用法）；模块清单 M11 行、功能矩阵 M11 行填写为已实现（v1） | 结构改动同步 |
| 2026-10-14 | tools/perf/perf_baseline.py（新增） | 横切-性能基线：11 个固定场景计时（解析/层级/几何/碰撞/矩阵/规则×2/融合/IDS/提取/报告PDF，--repeat 取 best/avg）；内核进程 RSS 采集（可选 psutil，按 python 名+cmdline 匹配、跳过 cmd/npm 包装）；--save 存 baselines/<名>.json（原子写）、--compare 回归比对（best 退化>20% 且>50ms 判回归，退出码 1） | 约 300 行；修正过一次进程误匹配（cmd.exe 9.3MB → python.exe 136MB） |
| 2026-10-14 | tools/benchmark/benchmark.py（新增） | 横切-黄金基准比对：record 固化 8 组确定性检查（摘要/几何/碰撞/矩阵/全规则/合规/IDS/提取）为 golden/<key>.json（原子写，浮点 4 位归一）；run 逐字段扁平化比对，报告落 .data/benchmark/，任一模型有差异退出码 1 | 约 280 行；L2 幂等约束是比对前提 |
| 2026-10-14 | 验证 | 横切工具验证：`python -m compileall -q tools` OK；两冒烟模型 record 成功（95 + 87 比对字段）；`benchmark run` 2/2 通过；`perf --save v0.12.0` 基线已存（11 场景 best 2.3–22.5ms，内核内存 136→139MB）；`perf --compare v0.12.0` 回归 0 个退出码 0 | 纯 tools/ 新增，L2/L3/L4 代码零改动 |
| 2026-10-14 | readme.md / docs | readme：tools 目录树补 benchmark/perf、横切工具行、使用说明新增「黄金基准比对」「性能基线」两节；模块清单横切模块两行改为已实现（v1）；功能矩阵表 3 #5 性能基线报告改为进行中（本产品侧已就绪，Solibri 侧待采集） | 结构改动同步 |
| 2026-10-14 | src/ruleset-editor/ + src/i18n/{zh,en}/ruleset.ts | i18n 改造：RulesetEditor / RuleEditor 全部界面中文串替换为 t()（含按钮/标签/占位/提示/通知/枚举标签），新增 69 个 ruleset.* 键，zh/en 键集一致 | 服务端数据（模板名/分类/IFC 类型/属性名）不翻译；`tsc --noEmit` 通过 |
| 2026-10-14 | src/clash/ClashMatrix.tsx + src/i18n/{zh,en}/clash.ts | 国际化（i18n）：面板全部用户可见中文文案改走 `useT()` 查表，新增 28 个 `clash.*` 键（中英词典键集一致）；枚举标签改 `clash.mode.*` 动态键，模块级 MODE_LABEL 常量移除 | 服务端返回的专业名/构件名/单元格 key 不翻译；`item.distance` 补 `?? ''` 适配 t() 参数类型 |
| 2026-10-14 | src/ids/IdsEditor.tsx + src/i18n/{zh,en}/ids.ts | IDS 编辑器模块国际化：全部用户可见中文接入 useT()/t()，新增 34 个 `ids.*` 键（中英词典键集一致） | 服务端数据（规范名/描述、IFC 类型、GUID、失败原因）不翻译；tsc 报错均为其他模块并行改动所致 |
| 2026-10-14 | src/views/ViewPanel.tsx + src/i18n/{zh,en}/views.ts | 视图系统面板国际化：全部用户可见中文接入 useT()/t()，新增 44 个 `views.*` 键（中英词典键集一致）；PRESETS/AXES 常量去掉中文 label，渲染时按 `views.preset.*` / `views.axis.*` 动态键查表 | 构件名/GUID、用户自命名视角等数据不翻译；`tsc --noEmit` 通过 |
| 2026-10-14 | src/report/ReportPanel.tsx + src/i18n/{zh,en}/report.ts | 报告面板国际化：全部用户可见中文接入 useT()/t()，新增 27 个 `report.*` 键（中英词典键集一致）；SEVERITY_LABEL / SOURCE_LABEL 常量移除，改 enumLabel 按 `report.severity.*` / `report.source.*` 动态键查表（未知值回退原始字符串） | 服务端数据（问题标题/原因/构件名/GUID/导出文件路径）不翻译；`tsc --noEmit` 通过 |

| 2026-10-14 | src/i18n/（新增） | L4 中英双语框架：轻量 Context + useT() 字典查表（无第三方依赖），默认中文、localStorage（archiken:lang）持久化、缺键回退中文；词典按模块拆分 zh/ 与 en/ 各 9 文件 | 单文件均 <500 行 |
| 2026-10-14 | src/main.tsx / App.tsx / model-tree/ / takeoff/ / communication/ / styles.css | i18n 接线：main 包 I18nProvider；顶栏右端新增 EN/中 切换按钮；App 三栏、模型源面板、融合树、信息提取面板、沟通面板文案全部 t() 化（app.* 45 键、tree.* 9 键、takeoff.* 31 键、comm.* 50 键，中英键集一致） | 状态/级别枚举存英文值、显示层查表翻译 |
| 2026-10-14 | readme.md / readme_en.md（新增） | readme 重写为专业排版中文版（徽章 / 目录锚点 / 核心能力与界面导览表 / 服务接口与工具链分节，保留全部操作性内容），新增英文镜像 readme_en.md，顶部互链 | 两版均含国际化说明节 |
| 2026-10-14 | 验证 | npm run typecheck 三套 tsconfig 全过；npm run build 全过 | i18n 全量改造完成 |
| 2026-10-14 | kernel/app/routes/geometry.py | 新增批量网格端点 `GET /geometry/meshes`：一次返回多构件顶点与索引，复用 `.kengeo` 缓存，供 3D 真实化显示 | 新增 30 行 |
| 2026-10-14 | src/services/kernel.ts | 新增 `MeshBatchResponse` 类型与 `geometryMeshes()` 封装；`ElementMesh` 保持 `extends BboxItem` | 新增 12 行 |
| 2026-10-14 | src/viewer/model.ts | 新增 `buildMeshLayer()`：BufferGeometry + Float32Array 真实三角网格，DoubleSide 材质；保留 `buildModelLayer()` 包围盒降级 | 新增 68 行 |
| 2026-10-14 | src/viewer/Viewer.tsx | `ViewerProps.items` 扩展为 `BboxItem[] \| ElementMesh[]`；新增 `useMesh` prop 决定构建模式 | 新增 6 行 |
| 2026-10-14 | src/App.tsx | 新增「真实模型」按钮：调用 `geometryMeshes(primaryPath)` 拉取网格并 `useMesh=true`；`loadFederation` 回退包围盒模式 | 新增 20 行 |
| 2026-10-14 | src/i18n/zh/app.ts + en/app.ts | 新增 `app.mesh` 键（真实模型 / Real Mesh） | 新增 2 行 |
| 2026-10-14 | 验证 | `npm run typecheck` 三套全过；`npm run build` 全过；`python -m compileall -q kernel` OK；内核冒烟全过；黄金基准 2/2 通过（重新 record 了 structural 模型） | 3D 真实化改造完成 |
| 2026-10-14 | readme.md / readme_en.md / docs/模块清单.md | 核心能力表与界面导览表新增「3D 真实化 / Real Mesh」行；内核端点表新增 `/geometry/meshes`；模块清单 3D 视图模块状态更新 | 结构改动同步 |
| 2026-10-14 | kernel/app/i18n.py | 新增服务端 i18n 工具：`pick_lang` 规范化语言参数，`pick_text` 按 `_en` 后缀取英文字段（缺省回退中文），`localize_rule/rules/preset/discipline` 本地化副本 | 新增 54 行（缺口B 基础） |
| 2026-10-14 | kernel/app/rules/templates/common.py + compliance.py | 24 条内置规则模板全部补 `name_en` / `category_en` / `message_en`；分类英译：碰撞检查→Clash Detection、合规检查→Compliance、模型质量→Model Quality、施工可行性→Constructability、无障碍→Accessibility、净高→Headroom、消防→Fire Safety | 双语字段 |
| 2026-10-14 | kernel/app/rules/presets.py | 4 个合规预设补 `name_en` / `description_en`；`list_presets(lang)` 按语言本地化（含 categories 映射） | 双语字段 |
| 2026-10-14 | kernel/app/federation/discipline.py | 7 个专业定义补 `name_en`（建筑→Architecture 等）；`rule_table(lang)` 按语言本地化 | 双语字段 |
| 2026-10-14 | kernel/app/federation/merge.py | `_model_entry` / `_new_bucket` / `build` 透传 lang，专业显示名按语言本地化 | 透传改造 |
| 2026-10-14 | kernel/app/rules/checks.py | 6 种检查函数加 `lang` 参数，违规 reason 与修复 steps 按语言双语生成（属性/相交/净距/净高/净尺寸/重复） | 动态文案双语 |
| 2026-10-14 | kernel/app/rules/evaluator.py | `run(..., lang)` 透传给全部检查函数 | 透传改造 |
| 2026-10-14 | kernel/app/routes/rules.py | `/rules/templates`、`/rules/presets`、`/rules/run`（GET+POST）支持 lang；`_run` 中对 prepared 规则先 `i18n.localize_rules` 再求值，修复英文模式下 message 模板仍中文覆盖 reason 的问题 | 端点 + 关键修复 |
| 2026-10-14 | kernel/app/routes/federation.py | `/federation/disciplines`、`/federation/merge`（GET+POST）支持 lang | 端点改造 |
| 2026-10-14 | kernel/app/clash/matrix.py + routes/clash.py | 冲突矩阵 `_ref` 与 disciplines 列表的专业名按 lang 本地化；`POST /clash/matrix` 支持 lang | 端点改造 |
| 2026-10-14 | server/kernel-client.ts + routes/report.ts + report/export.ts + routes/ruleset.ts | L3 全链路 lang 透传：`runRules` 加 lang 参数；`/report/run`、`/report/html`、`/report/export`、`/ruleset/run` 解析并透传 lang（缺省 zh） | 透传改造 |
| 2026-10-14 | src/services/kernel.ts + report.ts + ruleset.ts | `FederationOptions` / `ReportRunOptions` / `ClashMatrixOptions` 加 lang；`ruleTemplates`、`rulePresets`、`runRules`、`reportRun`、`reportHtml`、`reportExport`、`runRuleset`、`clashMatrix` 全部支持 lang 透传 | 客户端改造 |
| 2026-10-14 | src/App.tsx + views/ViewPanel.tsx + report/ReportPanel.tsx + ruleset-editor/RulesetEditor.tsx + clash/ClashMatrix.tsx | 五处调用点从 `useT()` 取 lang 并透传；ReportPanel 的 run 回调与 RulesetEditor 的加载 effect 依赖 lang（切语言自动重取） | 界面接线 |
| 2026-10-14 | 验证 | typecheck 三套全过；build 全过；compileall OK；冒烟全过；黄金基准 2/2 通过（重录 structural）；`/rules/run` lang=en 规则名/分类/reason 全英文、缺省中文回退正常；L3 `/report/run` lang=en 全链路英文 | 缺口B 改造完成 |
| 2026-10-14 | readme.md / readme_en.md / docs/模块清单.md | 第十节「范围」改为覆盖服务端数据文案，新增「服务端 i18n」说明（`_en` 后缀约定 + 全端点 lang 参数清单）；模块清单横切模块新增「服务端文案国际化」行 | 结构改动同步 |
| 2026-10-14 | readme.md / readme_en.md（删除） | 中英文 readme 合并为单文件 `readme.md`：每个章节先中文后英文交替排版（标题双语 / 表格中英并列 / 段落中英对照）；删除 `readme_en.md`；第十一节「同步更新 readme.md 与 readme_en.md」改为「同步更新本 readme.md」 | 文档合并 |
| 2026-10-14 | server/report/aggregate.ts | `buildReport(..., lang)` 与 `fromClash(clash, lang)` 改造：碰撞问题的 category/title/reason/steps 改为 `CLASH_I18N` 双语；排序 locale 随 lang | 修复碰撞问题英文下仍中文 |
| 2026-10-14 | server/report/html.ts | `renderReportHtml(report, lang)`：标题/严重度/统计项/表头全部走 `I18N` 双语字典，html lang 属性随语言 | 修复 HTML 报告英文下仍中文 |
| 2026-10-14 | server/report/export.ts + kernel-client.ts | `exportReportFile` 把 lang 传入 `buildReport`；`exportReport(report, format, title, lang)` 把 lang 写入请求体 | 导出链路透传 lang |
| 2026-10-14 | server/routes/report.ts | `reportHtmlGet` 把 lang 传给 `renderReportHtml` | HTML 端点本地化 |
| 2026-10-14 | kernel/app/report/render_pdf.py | `render_pdf(report, out, title, lang)`：摘要标签/表头/来源/严重度/标题走 `I18N` 双语；title 缺省时按语言取默认标题 | PDF 双语 |
| 2026-10-14 | kernel/app/report/render_xlsx.py | `render_xlsx(report, out, title, lang)`：sheet 名/摘要标签/表头/来源/严重度走 `I18N` 双语；title 缺省时按语言取默认标题 | XLSX 双语 |
| 2026-10-14 | kernel/app/routes/report.py | `ReportExportRequest.title` 改为 `str | None`，缺省 None；`report_export` 解析 lang 并传给渲染器 | 端点支持 lang + 标题本地化 |
| 2026-10-14 | 验证 | L3 `/report/run?lang=en` 碰撞问题全英文；`/report/html?lang=en` 标题/表头/统计全英文；PDF/XLSX 导出 lang=en 标题与 sheet 名英文；浏览器切 EN→Run Check 报告全英文（含 Clash Detection/Hard Clash），切回中文恢复中文；typecheck 通过；渲染器 en/zh 冒烟通过 | 缺口B 端到端生效 |
| 2026-10-14 | kernel/app/takeoff/columns.py | FIXED_FIELDS / SUGGESTED_COLUMNS 补 `name_en`；新增 `localize_columns()`；`normalize_columns` 保留 name_en | 信息提取列名双语 |
| 2026-10-14 | kernel/app/takeoff/export.py | `export_xlsx(result, out, lang)`：sheet 名/合计/是与否走 I18N 双语；表头调用 localize_columns | Excel 导出双语 |
| 2026-10-14 | kernel/app/routes/takeoff.py | `/takeoff/columns`、`/takeoff/run`、`/takeoff/export` 支持 lang；返回列名按语言本地化 | 端点支持 lang |
| 2026-10-14 | kernel/app/ifc/summary.py + routes/ifc.py | `exporter(model, lang)` "未知"→"Unknown"；`/ifc/summary` 支持 lang；federation merge 透传 lang | 摘要兜底双语 |
| 2026-10-14 | server/bcf/model.ts + service.ts + routes/issue.ts | `normalizeCreate` 默认分类按 lang 取「沟通问题」/「Communication Issue」；`importFromModel(..., lang)` 透传 lang 到 runRules+buildReport；issue import 路由解析 body.lang | 沟通问题导入双语 |
| 2026-10-14 | src/services/kernel.ts + takeoff/TakeoffPanel.tsx | `takeoffColumns/Run/Export` 与 `ifcSummary` 加 lang 参数；TakeoffPanel 从 useT() 取 lang 透传，effect 依赖 lang 自动重取 | 前端接线 |
| 2026-10-14 | 验证 | typecheck 三套全过；compileall OK；`/takeoff/columns?lang=en` 列名全英文（Element Name/Volume 等）；takeoff export lang=en sheet=Takeoff、表头英文、合计=Total；`/ifc/summary?lang=en` 兜底 Unknown | 服务端文案遗漏补全 |
| 2026-10-14 | server/routes/upload.ts（新增）+ index.ts | 新增 `/upload` 端点：接收原始字节保存到 `.data/uploads`（限 200MB，白名单后缀，时间戳防覆盖）；router.ts 加 `readRawBody` | 修复浏览器端无法添加 IFC |
| 2026-10-14 | electron/main.ts + preload.ts + src/types.d.ts | 新增 `archiken:openFile` IPC：原生文件选择对话框返回绝对路径；preload 暴露 `openFile` | 桌面端原生选文件 |
| 2026-10-14 | src/model-tree/ModelSourcePanel.tsx + services/kernel.ts | 新增「选择文件…」按钮：Electron 走原生对话框，浏览器走 file input + 上传；`uploadModelFile()` POST 二进制到 L3 | 前端接线 |
| 2026-10-14 | kernel/app/config.py | `model_roots()` 默认根目录加入 `.data/uploads`（原来只有 corpus，上传的文件被 403 拒绝） | 内核白名单放行上传目录 |
| 2026-10-14 | src/i18n/{zh,en}/tree.ts | 新增 `tree.pickFile` / `tree.uploading` 词条 | 双语词条 |
| 2026-10-14 | 验证 | 三套 typecheck 通过；上传 smoke-ifc4.ifc → 保存成功 → 内核 `/ifc/summary` 成功加载（IFC4, 17 products） | IFC 添加端到端打通 |
| 2026-10-14 | kernel/app/config.py | 修复上一次 PowerShell 写文件引入的 UTF-8 BOM（Python 启动报 U+FEFF 语法错误） | 编码修复 |
| 2026-10-14 | server/ruleset/model.ts | `CHECK_TYPES` 补齐 `headroom`/`dimension`，与内核 DSL（dsl.py 6 种）对齐；原来合规模板里的 3 条 dimension 规则无法保存进规则集 | 修复规则集保存被拒 |
| 2026-10-14 | 浏览器全功能审计 | 加载融合/3D 渲染/真实网格 PASS；规则集保存+运行 PASS（修复后）；冲突矩阵运行 PASS；IDS 示例+校验 PASS；信息提取运行 PASS；沟通问题创建/评论/BCF 导出 PASS；视图系统视角/剖切/标记 PASS；console 无报错 | 无摆设功能残留 |
| 2026-10-14 | server/i18n.ts（新增） | `tr(lang, zh, en)` + `langOf(body)` 轻量错误文案双语模块 | 错误文案双语基础 |
| 2026-10-14 | server/ruleset/model.ts + routes/ruleset.ts | `normalizeRuleset(raw, lang)`：空 rules/type 不合法/severity 不合法等校验消息双语 | 规则集保存校验双语 |
| 2026-10-14 | server/bcf/model.ts + service.ts + routes/issue.ts | 创建/评论/快照/BCF 导出的校验消息双语；评论默认作者「ArchiKen 用户」/「ArchiKen User」；默认分类双语统一走 tr | 沟通链路文案双语 |
| 2026-10-14 | server/routes/upload.ts | 文件类型/大小/空内容错误按 query.lang 双语 | 上传校验双语 |
| 2026-10-14 | src/services/{ruleset,issues,kernel}.ts + 3 面板 | saveRuleset/issueCreate/issueComment/issueBcfExport/uploadModelFile 加 lang 参数；RulesetEditor/CommunicationPanel/ModelSourcePanel 透传 | 前端接线 |
| 2026-10-14 | 验证 | typecheck server+frontend 通过；实测 ruleset 空规则 en="rules must be a non-empty array"/zh=中文、create 空标题 en="Missing title"、comment en="Missing comment text"、upload en="Unsupported file type..." | 服务端错误文案全双语 |
| 2026-10-14 | src/model-tree/ModelSourcePanel.tsx + i18n/{zh,en}/tree.ts | 合并冗余按钮：移除「选择文件…」按钮与路径输入框，「添加」成为唯一文件添加入口（点击直接弹文件对话框，Electron 原生 / 浏览器 file input）；删 tree.pickFile/tree.placeholder 词条；示例模型快捷按钮保留 | 交互简化 |
| 2026-10-14 | 验证 | typecheck 通过；浏览器实测：面板仅剩一个「添加」按钮、点击弹出文件选择对话框可正常取消、console 无报错 | 按钮合并端到端可用 |
| 2026-10-14 | kernel/app/federation/merge.py | 修复添加 IFC 后 3D 视图不显示：IfcOpenShell create_shape 输出坐标已是米（内部应用单位系数），merge 又乘 unit_to_meter 造成二次换算，毫米声明模型（如 Archicad 导出）被缩小 1000 倍挤在原点不可见；去掉 scale 乘法仅保留 georef 偏移 | 模型尺度双重换算 bug |
| 2026-10-14 | 验证 | Archicad 测试模型 merge 后墙 size=(4.0,0.45,2.5)m 正常；corpus 基准模型无回归（梁 4m/门 2.1m）；浏览器实测：融合渲染 PASS、滚轮缩放 PASS、拖拽旋转 PASS、console 无报错 | 模型可见性恢复 |
| 2026-10-14 | src/views/view.css + communication/communication.css + report/report.css | 修复弹窗过满：main.tsx 中 App（连带面板 css）先于 styles.css 导入，.editor-dialog 的 92vw/86vh 覆盖各面板专属宽度；视图/沟通/报告三面板改双类选择器（.editor-dialog.xxx-dialog）提高优先级，宽度 640/860/1100px + 高度自适应 | 弹窗宽度按内容收敛，不再顶满全屏 |
| 2026-10-14 | 验证 | 浏览器实测：视图面板 ~640px 居中、沟通面板 ~860px、报告面板 ~1080px，均两侧留空可见场景，console 无报错 | 三面板宽度符合预期 |
| 2026-10-14 | src/views/view.css | 视图面板内容区左右留白：`.view-section` padding 由 `12px 0` 改为 `12px 16px`，四区块内容与标题行左缘对齐、不再贴弹窗边框；分隔线保持满宽 | 内容与标题行对齐，留白均匀 |
| 2026-10-14 | 验证 | 浏览器几何测量：四区块左右留白与「视图系统」标题对齐、内容区等宽、console 无报错 | 留白对齐生效 |
| 2026-10-14 | kernel/app/ifc/loader.py + kernel/main.py + server/routes/upload.ts | 修复 IFC 解析 500：内核 open_model 捕获 ifcopenshell.Error/OSError → 400 友好提示（含文件名/大小）+ warning 日志栈；resolve_path 前置空文件校验；main.py 全局异常兜底（记录方法/路径/参数/栈，返回 JSON detail）；L3 上传增加魔数预检（ISO-10303-21/PK/glTF/JSON 头） | 非 IFC 内容与空文件不再 500 |
| 2026-10-14 | 验证 | 全场景实测：假后缀 400+格式头提示、空文件 400、不存在 404、越界 400、merge 带坏文件 400 指名文件、截断 IFC 容错 200；正常模型 summary/merge 回归 200 | 错误场景友好化，正常流程无回归 |
| 2026-10-14 | kernel/app/ifc/summary.py + kernel/app/federation/merge.py | 修复 IFC2X3 模型加载后 3D 空白：`IfcMapConversion` 是 IFC4 实体，IFC2X3 schema 不存在，`model.by_type("IfcMapConversion")` 抛 RuntimeError → 500 → 前端拿不到融合数据；`summary.georeference()` 与 `merge.georef_offset()` 均包 try/except RuntimeError，无该实体时返回 `{present: false}` / 零偏移 | IFC2X3 schema 兼容 |
| 2026-10-14 | kernel/main.py | 全局异常兜底由 `@app.exception_handler(Exception)` 改为 `@app.middleware("http")` try/except：Starlette 0.52 的 ServerErrorMiddleware 抢先于 exception_handler，导致 500 返回裸文本而非 JSON；middleware 包裹 call_next，任何未处理异常记录完整栈并返回 `JSONResponse(500, {"detail": ...})` | 裸 500 文本 → JSON 500 |
| 2026-10-14 | 验证 | MEP 模型（IFC2X3, 2588 构件, Archicad 29.2）`/ifc/summary` 200，georeference={present:false}；`/federation/merge` 200，1824 几何构件 bbox 米级正常；`/clash/matrix` 200；内核日志无 "Exception in ASGI application" 泄漏 | IFC2X3 全链路打通 |
| 2026-10-14 | kernel/app/geometry/extract.py | 多材质构件按材质拆分：`extract_entry` 返回 `dict[str,dict]`，含多材质（material_ids 长度>1）的构件按 `{guid}#m{mid}` 拆分为子条目，每个含 `material` 与 `parent_guid` 字段 | 幕墙/墙等多材质构件可独立选中框料与玻璃 |
| 2026-10-14 | kernel/app/geometry/cache.py | `.kengeo` MAGIC 由 `KENGE\x02` 升至 `KENGE\x03`，每条目新增 `material`、`parent_guid` 字符串字段 | 缓存格式升级，旧缓存自动失效重建 |
| 2026-10-14 | kernel/app/federation/merge.py | `by_guid(entry.get("parent_guid") or guid)`；items 输出新增 `material`、`parent_guid` 字段 | 融合层透传材质信息 |
| 2026-10-14 | kernel/app/clash/engine.py + matrix.py | `_ref` 与 `by_guid` 改用 `entry.get("parent_guid") or guid` 查父构件 | 碰撞检测按父构件定位 |
| 2026-10-14 | kernel/app/ifc/properties.py | `element_detail` 对 `guid.split("#",1)[0]` 去后缀查父构件属性 | 子构件属性面板显示父构件完整属性 |
| 2026-10-14 | kernel/app/geometry/extract.py | 材质名解析（`_material_names`/`_style_rendering_id`/`_material_name_map`）：从 `IfcSurfaceStyle.name` 正则提取 rendering id，经 ConstituentSet→Material→HasRepresentation→StyledItem→SurfaceStyle→SurfaceStyleRendering.id 链路映射材质名；按材质集 constituent 顺序兜底 | 铝板/普通玻璃等中文名正确解析 |
| 2026-10-14 | src/services/kernel.ts + src/App.tsx + src/styles.css | `FederationElement` 接口新增 `material?`、`parent_guid?`；属性面板新增材质徽章（绿色），选中子构件时显示材质名 | 前端展示材质名 |
| 2026-10-14 | 验证 | testwall01（IFC4 玻璃幕墙）`/federation/merge` 返回 13 几何构件（原 6）：幕墙→普通玻璃(320面)+铝板(312面)，墙→粉刷石膏砂浆/粘土砖/1:2水泥砂浆/挤塑板XPS；浏览器实测：选中玻璃显示「普通玻璃」徽章，选中铝框显示「铝板」徽章，拾取正常，console 无报错 | 多材质拆分全链路打通 |
| 2026-10-14 | kernel/app/federation/discipline.py | 修复 MEP 模型专业误分：①NAME_RULES 去除 "water"（误中 Waterproof 防水膜→给排水）与 "light"（防 Lightweight 误伤），补充 steel/concrete/structural（→结构）、plaster/gypsum/brick/stone/insulation/membrane/finish/waterproof（→建筑）等英文建材词；②TYPE_RULES 建筑类新增 IfcBuildingElementPart / IfcOpeningElement，给排水补 IfcStack/IfcFireSuppression；③IfcOpeningElement 特判直接归建筑（洞口名继承被穿透构件，曾随 DUCT 名误入暖通）；④MEP 三色值调整为互异标准色：暖通 #2fb377（绿）/ 给排水 #2f9fd8（蓝）/ 电气 #e0a92e（琥珀黄） | MEP_Designer_Sample_File 全部 1252 个 IfcBuildingElementPart 曾统一落入暖通绿色 |
| 2026-10-14 | 验证 | MEP 模型分类修正：hvac 仅剩真正风管（FlowSegment 132 + FlowFitting 97 + DistributionFlowElement 45），洞口 107 全归建筑，BuildingElementPart 按名分结构 587 / 建筑 700；testwall01 幕墙拆分无回归（玻璃/铝板独立，归建筑）；内核冒烟测试全过；浏览器实测：图例色值正确（#2fb377/#f2a154/#4f7cff）、console 无报错 | 分类与配色修复生效，无回归 |
| 2026-10-14 | src/viewer/scene.ts | 新增剖切面拖拽能力：`setSectionAxis` 锁定轴并暂停轨道旋转、`onSectionDrag` 回调、`setSectionRangeProvider` 供范围；`pointerdown` 判定左键后记录拖拽起点，`pointermove` 把指针位移沿该轴屏幕投影方向换算为世界坐标并实时回传（轴投影退化时退回水平映射，避免顶视下拖不动） | 需求 4：视图内拖拽实时调节 |
| 2026-10-14 | src/viewer/Viewer.tsx | ViewerHandle 新增 `getClipStates` / `onClipChange` / `setSectionDrag`；剖切控制器状态变更统一经 `emitClipChange` 广播；拖拽回调直接写入 `ClippingController` 并回传 UI | 剖切状态与 UI 双向同步 |
| 2026-10-14 | src/views/ClipControls.tsx（新建） | 剖切控件独立成文件：每轴一行「轴按钮 / 拖动 / 翻转 / 滑杆 / 数值」，点击轴按钮即启用剖切（默认从 + 端切、位置取范围中点），滑杆实时改位置，翻转切向，支持多轴并行 | 需求 1/3：剖切 1 步启用，无确认与存盘 |
| 2026-10-14 | src/views/ViewPanel.tsx | 模态弹窗改为非模态浮动卡片（可收起 / 展开）；视角区改为分段控件 + 7 标准视角高亮（点击即到）；剖切区接入 ClipControls；拖拽按钮改切换语义（再次点击同一轴取消锁定）；标记与演示视角逻辑完整保留 | 需求 1/2：消除多步操作、切换无跳转 |
| 2026-10-14 | src/views/view.css | 新增 .view-float 浮动卡片、.view-float-top 头部、.clip-row 五列网格与 .clip-slider 等样式；移除旧 .editor-dialog.view-dialog 规则 | 浮窗贴 3D 视图区，不遮挡场景 |
| 2026-10-14 | src/i18n/zh/views.ts + src/i18n/en/views.ts | 新增 `views.collapse` / `views.expand` / `views.drag` / `views.dragHint` / `views.clipEnableAxis` / `views.clipFlip` / `views.clipOff` / `views.clipHint` 双语词条 | 新交互全链路双语 |
| 2026-10-14 | readme.md | 视图系统说明、能力表、层清单与模块清单同步：注明非模态浮窗、一键视角、按轴一键剖切、3D 内拖拽；模块表新增 `src/views/ClipControls.tsx` | 文档同步 |
| 2026-10-14 | 验证 | typecheck + build 通过；浏览器全场景交互测试（7 预设 × 2 模式 × 3 轴剖切 × 拖拽 / 滑杆 / 标记 / 演示视角 / 折叠）：预设切换 32.7~33.5ms、模式切换 33.2~33.4ms、按轴剖切 33.2~33.4ms、滑杆 33.3~33.4ms、拖拽逐步 33.2ms（均含 2 帧节流，实际处理 <1 帧），Z 轴拖拽 2.01→-1 实时生效；标记载入 7 项、演示视角保存与列表回显正常、折叠展开正常、console 无报错 | 需求 5/6：全部操作 <100ms，无回归 |
| 2026-10-14 | src/App.tsx + src/styles.css | 消除视图入口重复：顶栏「视图」由「只能打开」改为真开关（点击在开 / 关间切换），开启时套 `toggle-on` 类高亮；新增 `button.ghost.toggle-on` 样式 | 原来「打开在顶栏、关闭在浮窗内」两套控制各管一半，且顶栏按钮点第二次无反应 |
| 2026-10-14 | src/views/ViewPanel.tsx + src/i18n/{zh,en}/views.ts | 浮窗头部移除「关闭」按钮（Props 去掉 onClose，App.tsx 同步移除接线），只保留「收起 / 展开」；删除 `views.close` 词条 | 顶栏成为唯一开关，浮窗内不再有重复关闭入口 |
| 2026-10-14 | 验证 | typecheck + build 通过；浏览器实测：顶栏按钮初始 `ghost`（关）→ 点击后 `ghost toggle-on` 且浮窗出现 → 再点击回到 `ghost` 且浮窗消失 → 浮窗内「收起」后主体隐藏、按钮文案变「展开」→ 再点击恢复；浮窗头部仅剩 1 个按钮、已无「关闭」；console 无报错 | 开 / 关 / 收起 / 展开四条路径均正常 |
| 2026-10-14 | src/views/ViewToolbar.tsx（新建） | 从浮窗迁出高频操作，改为固定占位在 3D 视图上方的工具条（flex 子项、非浮层）：透视 / 平面、7 标准视角、X / Y / Z 剖切一键启用 + 实时滑杆 + 翻转 + 拖动锁定 + 全部清除；内联迁入 `CLIP_AXES` / `makeClipStates` / `axisMidPoint` / `ClipAxisState` / `ClipRangeValue` 等 helper | 原浮窗 344px 宽贴右侧，1440 窗口下压掉约 42% 画布宽度，只做手风琴治不彻底 |
| 2026-10-14 | src/views/ClipControls.tsx（删除） | 剖切控件合并进 ViewToolbar，原文件不再引用 | 单一模块只做一件事，避免重复维护 |
| 2026-10-14 | src/views/ViewPanel.tsx（重写） | 只保留低频项（3D 标记 / 演示视角），改为手风琴分区（默认全折叠），头部即拖动把手（pointerdown/move/up + 边界钳制，`setPointerCapture` 加 try/catch 兼容合成事件）；移除 collapsed 状态、收起/展开按钮、onClose、clips/range/dragAxis 及 ClipControls 引用 | 浮窗默认高度 344×125，展开分区才变高 |
| 2026-10-14 | src/views/view.css | 头部加 `cursor:move; user-select:none; touch-action:none`；`.view-float-body` 改 `flex:1 1 auto` 可滚动；新增手风琴 `.view-sec` / `.view-sec-head` / `.view-caret` / `.view-sec-count` / `.view-sec-body` 与工具条 `.view-toolbar` / `.vt-group` / `.vt-sep` / `.vt-btn` / `.vt-axis` / `.vt-label` / `.vt-slider` / `.vt-value`；删除已无用的 `.view-float.collapsed` / `.view-grid7` / `.clip-*` 规则 | 工具条窄窗口自动折行，零遮挡 |
| 2026-10-14 | src/i18n/zh/views.ts + src/i18n/en/views.ts | 新增 `views.toolbar` / `views.dragPanel`；`views.tagline` 改为「3D 标记 · 演示视角」；删除已无引用的 `views.collapse` / `views.expand` / `views.sectionView` / `views.orthographic` / `views.clipEnable` / `views.clipFromPlus` | 文案与控件精简后保持一致 |
| 2026-10-14 | src/App.tsx + readme.md | 中心栏画布上方接入 `<ViewToolbar viewerRef={viewerRef} modelPath={primaryPath} />`；readme 视图能力行与模块清单同步（删 ClipControls 行、加 ViewToolbar 行、ViewPanel 行改为手风琴 + 可拖拽） | 文档同步 |
| 2026-10-14 | 验证 | typecheck + build 通过；浏览器实测：工具条与画布 `overlapPx=0`（完全不遮挡、同宽）、预设 28.1ms、剖切 32.9ms、滑杆 33.3ms（均 <100ms）、浮窗默认 344×125（两分区全折叠）、展开首分区后高 288px、拖动 left 770→570 / top 60→180 成功、console 无报错 | 遮挡问题根除，操作延迟达标 |
| 2026-10-14 | kernel/app/geometry/extract.py | 单构件几何条目新增 `discipline` 字段（延迟导入 `app.federation.discipline.classify_element`，避免 geometry / federation 包形成导入环），多材质拆分出的子条目共用同一专业 | 原几何接口不返回专业，真实网格模式无法按专业分组，「透视外壳」在网格模式下无法生效 |
| 2026-10-14 | kernel/app/geometry/cache.py | 缓存 MAGIC 升为 `KENGE\x04`（v4 新增 discipline 字段），读写同步补字段 | 旧缓存自动失效重提取，字段对齐 |
| 2026-10-14 | kernel/app/routes/geometry.py | `/geometry/bboxes` 与 `/geometry/meshes` 响应条目补 `discipline` | 两个几何接口口径一致 |
| 2026-10-14 | src/services/kernel.ts | `federationToBboxItems` 的 `discipline` 由专业显示名（本地化）改为专业 key（与几何接口口径统一） | key 与语言无关，跨端/跨模式一致 |
| 2026-10-14 | src/viewer/model.ts | 材质缓存键由「颜色」改为「专业 + 颜色」（保留同专业同色共用、切语言不串色）；新增 `byDiscipline` 分组与 `makeShellFade`：`setShellFade(true)` 把 architecture / structural / site 三类专业透明度 0.92 → 0.12 并关闭 `depthWrite`（否则半透明外壳会遮挡其后的内部管线），关闭时原样恢复；包围盒与真实网格两个构建器均接入 | 方案 B：不改着色、不换材质，仅按专业整组切透明度 |
| 2026-10-14 | src/viewer/Viewer.tsx | `ViewerHandle` 新增 `setShellFade(on)`；`shellFadeRef` 记录开关状态，图层重建（换模型 / 切换包围盒与网格模式）后自动回填 | 避免重建图层后淡化状态丢失 |
| 2026-10-14 | src/views/ViewToolbar.tsx | 视角分组新增「透视外壳」开关按钮（开启套 `view-active` 高亮，复用已有样式，无新增 CSS） | 先加开关试效果，暂不做透明度滑杆 |
| 2026-10-14 | src/i18n/zh/views.ts + src/i18n/en/views.ts | 新增 `views.shellFade`（透视外壳 / X-Ray Shell）与 `views.shellFadeHint` 双语词条 | 双语一致 |
| 2026-10-14 | 验证 | compileall / 导入环检查（extract + federation 同时导入正常）通过；内核重启后 `/geometry/bboxes` 与 `/geometry/meshes` 均返回 `discipline`（cache_hit=False 触发重提取，2131 个几何构件）；typecheck + build 通过；浏览器实测点击「透视外壳」按钮类 `ghost vt-btn` → `view-active vt-btn` → 再点恢复，截图对照确认建筑 / 结构 / 场地构件由实心块变为近透明线框、非外壳构件不变，画布平均亮度 240.66 → 241.02 → 240.66（smoke 场景构件少故差値小），console 无报错 | 开关生效且可逆，网格模式专业数据已就位 |
| 2026-10-14 | readme.md | 视图能力行与模块清单（model.ts / Viewer.tsx）同步「透视外壳」；内核接口表 `/geometry/bboxes` 与 `/geometry/meshes` 标注返回专业 key | 文档同步 |
| 2026-10-14 | src/viewer/model.ts | `setShellFade` 由固定 0.12 改为接收任意透明度参数；固定值改为导出常量 `DEFAULT_SHELL_OPACITY = 0.12` | 用户要求透明度可调 |
| 2026-10-14 | src/viewer/Viewer.tsx | `ViewerHandle.setShellFade(on, opacity?)` 带透明度参数；`shellFadeRef` 改存 `{on, opacity}`，图层重建后按完整状态回填 | 开关 + 数值一起记忆 |
| 2026-10-14 | src/views/ViewToolbar.tsx + src/views/view.css | 「透视外壳」开启后按钮旁出现透明度滑杆（0.05 ~ 0.90、步长 0.01）与百分比数值，拖动实时生效；关闭即隐藏滑杆；新增 `.vt-fade` 固定宽度（120px）避免与剖切滑杆互相挤压 | 滑杆仅开启时出现，工具条默认宽度不变 |
| 2026-10-14 | src/i18n/zh/views.ts + src/i18n/en/views.ts | 新增 `views.shellFadeSlider`（外壳不透明度提示）双语词条 | 双语一致 |
| 2026-10-14 | 验证 + readme.md | typecheck + build 通过；浏览器实测：滑杆 min/max/step = 0.05 / 0.9 / 0.01，0.05 端亮度 241.06 > 0.9 端 240.71（越透越亮、方向正确），console 无报错；readme 能力行与工具条模块行补「透明度滑杆」 | 滑杆生效且可逆；smoke 场景外壳像素少故亮度差值小 |
| 2026-10-14 | src/viewer/Viewer.tsx | 图层重建（换模型 / 切显示模式）后新增：`clipRef.current?.clear()` 清空旧剖切 + `emitClipChange()` 通知订阅方；剖切包围盒改为建模时缓存一次（`clipBox.clone()`），`getRange` 从每次全场景遍历降为 O(1) | 修 Bug：旧模型剖切坐标残留，新模型被旧坐标剖开；同时支撑订阅回显高频取范围 |
| 2026-10-14 | src/views/ViewToolbar.tsx + src/App.tsx | 剖切范围 / 轴状态回填从「modelPath 变化时 effect 重跑」改为完全由 `onClipChange` 订阅驱动（回调里同步 `setRange(viewer.getClipRange())`），删除 `modelPath` prop | 修 Bug：工具条挂载早于图层重建读到旧空场景（滑杆区间退化 0~1），切显示模式后区间陈旧；现在任何重建都会经通知重取 |
| 2026-10-14 | src/views/ViewPanel.tsx | `onHeaderMove` 增加 `event.buttons & 1` 校验：pointer capture 失败后在面板外松开时清 `dragRef`，杜绝「悬停即拖走」 | 修 Bug：合成事件 / 指针失效场景 dragRef 残留 |
| 2026-10-14 | kernel/app/geometry/extract.py | `_discipline_key` 加 try/except 兜底返回 "other"（个别构件分类异常不再拖垮整个几何提取）；`extract_entry` / `extract_all` 传递文件名模型提示 `classify_model(Path(path).name)`，几何接口与融合模式的专业口径统一 | 修 Bug：无兜底 + 两模式口径可能不一致 |
| 2026-10-14 | kernel/app/geometry/cache.py | `cache.load` 异常捕获补 `UnicodeDecodeError`（含非法 UTF-8 的损坏缓存走重提取而非 500）；MAGIC 升 `KENGE\x05`（discipline 带模型提示，口径变化使旧 v4 缓存失效） | 修 Bug + 缓存口径演进 |
| 2026-10-14 | tools/benchmark/golden/smoke-structural-ifc4.json | 黄金基线 record 更新：`clash.triangle_tests` 153 → 154（碰撞问题数与其他 86 个字段均无差异） | 基线漂移归因：09:08 记录后 kernel 有拆分改造（41a09e6）与 MEP 分类修复（03e8017）两次已验收演进；非本次回归 |
| 2026-10-14 | 验证 | 全面代码审查（近 4 提交 diff 专项审查 + 自查 discipline 链路消费方）发现 2 中 4 低问题并全部修复；typecheck + build + compileall 通过；内核冒烟测试通过；黄金基准比对 2/2 全过；浏览器实测「点 X 点亮 → 切真实模型 → X 自动熄灭 + 剖切滑杆进入禁用态」，console 无异常 | 审查修复闭环，基线同步 |
| 2026-10-14 | kernel/app/geometry/extract.py | 新增 `_material_colors(shape)`：从 IfcOpenShell 三角化结果的 `geometry.materials`（style 对象列表）提取 IFC 原生表面色——真样式 name 形如 `IfcSurfaceStyleRendering-<id>`，颜色取 `style.diffuse.components`（本项目绑定中 diffuse 是 colour 对象，`.r/.g/.b` 与迭代访问均抛 TypeError）；无样式构件默认 style name 为 IFC 类型名，返回 None 由前端回退类型色；`_split_by_material` 与 `extract_entry` 单 / 多材质条目均带 `color` 字段 | 逆向三版修正：迭代 diffuse、属性 `.r/.g/.b`、`has_diffuse` 均在当前绑定抛 TypeError，最终以 name 前缀过滤 + components 取色，MEP 样例 2042/2131 构件成功取到原色 |
| 2026-10-14 | kernel/app/geometry/cache.py | 缓存 MAGIC 升为 `KENGE\x06`（v6 新增 color 字段），读写同步补字段，load 异常捕获含 UnicodeDecodeError | 旧缓存自动失效重提取 |
| 2026-10-14 | kernel/app/routes/geometry.py | `/geometry/meshes` 响应条目新增 `ifc_color`（IFC 原生色）与 `discipline_color`（按 discipline 映射专业标准色） | 显色模式切换的数据源就位 |
| 2026-10-14 | src/services/kernel.ts | `BboxItem` 新增 `ifc_color?` / `discipline_color?`，`ElementMesh` 自动继承 | 类型对齐 |
| 2026-10-14 | src/viewer/model.ts | 新增 `ColorMode`（discipline / ifc）与 `modeColor` / `materialKey(item, mode)`；`buildMeshLayer(items, mode)` 按模式选色（无原色回退 `colorForType` 类型色）；`buildModelLayer` 显式恒用专业色 | 显色书签核心切换逻辑 |
| 2026-10-14 | src/viewer/Viewer.tsx | props 新增 `colorMode?`（默认 discipline），图层重建 effect 依赖加入 colorMode | 模式切换即时重建图层 |
| 2026-10-14 | src/App.tsx | 左栏原「专业分类」标题位改为两页签（专业分类 / 原始颜色，点谁谁在上）；新增 `colorMode` 状态与 `ifcLegend` 原色聚合图例（top8）；包围盒模式强制回退专业分类（useMesh=false 时 effect）；Viewer 接线 `colorMode` | 用户方案：两种显色都在原专业分类位置做书签 |
| 2026-10-14 | src/styles.css | 新增 `.color-tabs` / `.color-tab` / `.color-tab.on` / `.color-tab:disabled` 样式 | 页签高亮与置灰 |
| 2026-10-14 | src/i18n/zh/app.ts + src/i18n/en/app.ts | 新增 `app.colorMode.ifc` / `ifcDisabled` / `ifcHint` / `count` 双语词条 | 双语一致 |
| 2026-10-14 | src/App.tsx + src/i18n/zh|en/app.ts | busy 状态由 'load' 拆为 'fed' / 'mesh'，两个顶栏按钮各自正确显示加载中文案（新增 `app.meshLoading`「构建中…/Building…」） | 修 Bug：点「真实模型」时无反馈，且「加载融合」按钮误显「融合中…」 |
| 2026-10-14 | 验证 | typecheck + build + compileall 通过；接口实测 MEP 样例 2042/2131 构件有原色（warm cache 2.6s / 冷提取 60.9s）；浏览器端到端：bbox 模式原始颜色置灰 + tooltip、点真实模型按钮即变「构建中…」、网格模式页签解禁、切原始颜色后 IFC 原色图例 8 条（#f2f2f2×295、#454545×277 等）与内核数据吻合、3D 截图两模式差异显著（专业绿 vs 真实棕墙白面灰顶）、切回专业分类图例恢复、console 无报错 | 前轮子代理报「页签不解禁」为误报：其点击后仅轮询 20s，而首次请求触发 v6 缓存重建需 60s+，setUseMesh(true) 未及执行；代码本身无 Bug | 
| 2026-10-14 | kernel/app/routes/geometry.py + src/services/kernel.ts + src/viewer/model.ts | 玻璃面组自动半透明：`/geometry/meshes` 透出缓存中的材质名 `material`（普通玻璃 / 铝板等）；`BboxItem` 补 `material?`；model.ts 新增 `GLASS_OPACITY=0.35` 与 `isGlass`（材质名含 glass/玻璃），`materialKey` 加玻璃位防止同色玻璃与框料共用材质，玻璃材质低粗糙度 + 关深度写入（避免双面半透明自遮挡），「透视外壳」回填时玻璃恢复玻璃透明度而非常规值 | 幕墙框料 / 玻璃观感优化：框料实心、玻璃可看穿；testwall01 浏览器实测专业配色与 IFC 原色两模式玻璃均呈半透明、框料实心、透视外壳共存无伪影，typecheck/build 通过，内核重启后生效（缓存不变无需重提取） |
| 2026-10-15 | src/viewer/model.ts | `isGlass` 判定从「仅材质名含 glass/玻璃」扩为「IfcWindow / IfcDoor 整类 + 材质名含 glass/玻璃」，所有以玻璃为主的 IFC 构件（窗、门、幕墙玻璃面组）在真实网格模式下均自动半透明（35%）、框料保持实心 | 覆盖 testwall01 这类窗玻璃材质名为样式兜底名（IfcSurfaceStyleRendering）缺关键词的模型；typecheck/build 通过 |
| 2026-10-15 | start.ps1 + start.bat + stop.ps1 + stop.bat（新建）+ readme.md | 新增单机版一键启动器：start.bat 双击转调 start.ps1，依次完成环境自检（Python/Node/pip 包/npm 包，缺失自动安装）→ 拉起内核 (4319)、业务服务 (4318)、前端 (5173)（已占用端口自动复用不重启）→ 健康检查就绪后自动开浏览器；stop.bat/stop.ps1 按端口结束全部服务进程 | 修正：PS 5.1 把无 BOM 的 UTF-8 误读为 GBK 致中文引号解析失败，两个 ps1 改用 UTF-8 with BOM 重写后语法通过；start.ps1 实测走复用路径成功并开浏览器；依赖检查清单按 kernel/requirements.txt 核对（fastapi/uvicorn/ifcopenshell/ifctester/openpyxl/reportlab），去掉误报的 numpy/trimesh 等；L3 健康检查路径确认为 /health（路由无前缀） |
| 2026-10-15 | start.bat + stop.bat | 修复双击 start.bat 失败：bat 含中文但以 UTF-8 存储，cmd 按 GBK 读取导致 REM 注释乱码成非法命令（start.log 报「不是内部或外部命令」）；两个 bat 改用 GBK 编码重写（cmd 原生读取），并给 start.bat 加 start.log 失败日志捕获便于排查 | 双击失败根因是 bat 文件编码，非 ps1 逻辑问题；GBK 重写后实测启动流程完整跑通（环境自检→三服务复用→健康检查→自动开浏览器） |
| 2026-10-15 | kernel/app/routes/geometry.py + src/services/kernel.ts + src/viewer/model.ts + src/App.tsx | 真实模型多模型叠加（方案 B）：`/geometry/meshes` 响应新增 `model_offset`（复用 georef_offset 的地理参考平移）；`BboxItem` 补 `position_offset`；model.ts `buildMeshLayer` 按 `position_offset` 平移各网格、`centerOf` 叠加偏移保证多模型下定位准确；App.tsx `loadMeshes` 由「仅第一个源」改为「`Promise.all` 并发拉取全部源」，每个 item 带该源偏移且 guid 加源序号前缀防跨模型 guid 冲突，按钮 disabled 条件改为 `!sources.length` | 修复用户反馈「多模型仅第一个能显示」；接口实测两源均返回 model_offset（无地理参考为零向量），浏览器端到端两源真实网格同时叠加显示无报错，typecheck/build/compileall 通过；内核重启用前台方式（Start-Process Hidden 启动后立即退出，原因待查但前台稳定） |
| 2026-10-15 | src/model-tree/ModelSourcePanel.tsx + src/App.tsx + src/services/kernel.ts + src/styles.css + src/i18n/zh|en/tree.ts | 模型源显示开关（方案 A 视觉层）：每个源行前加小圆点开关键（默认开=实心蓝，关=空心灰），关闭则该模型在 3D 中隐藏、源行置灰；仅影响显示不影响融合/检查/算量计算。App.tsx 新增 `hidden` 索引集合 + `visibleItems`（bbox 按 item.model、mesh 按 guid 前缀过滤）+ 源增删清越界索引；Viewer 改用 visibleItems；修 Bug：`federationToBboxItems` 丢失 `model` 字段致过滤全归索引 0（补 `model` 并给 BboxItem 加 `model?`） | 浏览器实测：关 #0 亮度 14019→8233（剩 #1 五构件）、关 #1→11142（剩 #0 十四构件），截图确认关闭后对应模型消失、源行圆点空心+置灰，重新打开恢复；typecheck/build 通过；接口实测融合 element model 分布 {0:14,1:5} |
| 2026-10-15 | server/index.ts + kernel/main.py + src/services/transport.ts + vite.config.ts + deploy/（新建 Dockerfile.kernel / Dockerfile.server / docker-compose.yml / nginx.conf / deploy.ps1 / .env.example / 版本同步规范.md / 更新操作SOP.md） | 云端部署适配 + 版本同步体系：① L3 监听改为 `ARCHIKEN_SERVER_HOST`（默认 0.0.0.0）+ API Key 鉴权中间件（环境变量开关，未配置则本地无鉴权）；② L2 host/port 支持环境变量；③ 健康检查加 build 字段（`ARCHIKEN_BUILD_ID` 注入）；④ transport.ts 加 `VITE_APP_MODE` / `VITE_ARCHIKEN_API_KEY` 环境变量，fetch 自动带 Authorization 头；⑤ vite.config.ts 加 define 注入构建模式；⑥ 写 Docker Compose 三容器编排（内核 + 业务 + Nginx 反代，持久化卷，健康检查）；⑦ 写 Nginx HTTPS 配置（速率限制、SPA 回退、安全头）；⑧ 写 deploy.ps1 部署脚本（前端构建→版本标识→上传→远程 docker compose up→三端健康检查→版本证据输出）；⑨ 版本同步规范（单一主干、构建模式切换、同步校验清单、漂移预警）；⑩ 更新 SOP（备份→构建→发布→双端验证→回滚预案） | 架构不拆分叉，Electron/Web 共用同一套代码仅 VITE_APP_MODE 区分传输路径；API Key 鉴权可选开关（本地无密钥=开发模式放行）避免影响单机版；Docker 容器用预构建 ifcopenshell wheel + fonts-noto-cjk 解决 reportlab 中文；部署脚本 PowerShell 5 下退出码不走管道保留；版本证据链三重锚点（build_id / frontend_hash / git_commit）确保双端一致；用户确认阿里云服务器+宝塔+Docker Compose+已备案域名+阿里云免费证书+API Key 鉴权方案 |
| 2026-10-15 | tsconfig.json + deploy/Dockerfile.server + deploy/docker-compose.yml + deploy/nginx.conf + deploy/deploy.ps1 | Advisor review 后修复 4 项关键问题：① tsconfig.json 加 `"vite/client"` 类型声明解决 `import.meta.env` 编译报错；② Dockerfile.server 改为多阶段构建（builder 全依赖+tsc 编译 → runtime 仅运行时依赖+node 跑 JS），消除 tsx 在 devDep 里的位置问题；③ docker-compose 去掉 Nginx 容器（宝塔自带 Nginx 占用 80/443），后端容器端口改为 `127.0.0.1:4318/4319` 绑定（仅宝塔 Nginx 能反代，公网不可直连）；④ nginx.conf 改写为宝塔反代配置模板（location 块粘贴方式），前端静态资源直接放宝塔站点根目录；⑤ deploy.ps1 重写适配宝塔方案（两个上传目录分别放 Docker 文件和 Web 静态资源，部署完提示宝塔 Nginx 配置步骤） | 验证：typecheck + compileall + VITE_APP_MODE=cloud build 全部通过（产物 hash=ClcKggP5）；kernel-client.ts 已支持 ARCHIKEN_KERNEL_URL 环境变量无需修改；宝塔反代路径 `/api/kernel/` → `127.0.0.1:4319`、`/api/server/` → `127.0.0.1:4318`，前端同源 `/api/*` 路径天然匹配 transport.ts 的 PROXY_PREFIX |
| 2026-10-15 | tsconfig.server.build.json（新建）+ deploy/（Dockerfile.kernel / Dockerfile.server / docker-compose.yml / .env / dockerignore / build-deploy-zip.ps1 / DEPLOY_ON_BT_PANEL.md） | 上线前逐项技术自检，修复 5 处会导致首次部署失败或线上不可用的问题：① `tsconfig.server.json` 含 `noEmit:true`，`tsc --outDir` 不产出任何文件 → 新建 `tsconfig.server.build.json`（`noEmit:false` + `module:CommonJS` + `outDir:dist-server`），实测编译产物可在 node 下正常启动（/health 通过，全部路由模块加载成功）；② compose 里内核缓存挂载路径写错（挂 `/root/.cache/archiken`，内核实际用 `PROJECT_ROOT/.cache`），且内核有模型路径白名单只认 `PROJECT_ROOT/.data/uploads`，而云端上传目录是 `/data/uploads` → 改为 `ARCHIKEN_MODEL_ROOTS=/data/uploads`、`ARCHIKEN_CACHE_DIR=/data/.cache`、`ARCHIKEN_DATA_DIR=/data`，与 L3 共享同一数据卷 `archiken-data`；③ 前端内置 API Key 等于把密钥公开在公网 JS 里 → 打包脚本不再注入 Key（`.env` 的 `ARCHIKEN_API_KEY` 留空），公网防护改由宝塔 Nginx 基础认证承担；④ 构建上下文由 `..` 改为 `.` 并配套 `.dockerignore`，避免把前端产物与本地残留打进镜像；⑤ 镜像内改用阿里云 PyPI 源与 npmmirror 源、跳过 electron 二进制下载（devDep 但国内易失败）、去掉 gcc 与字体包（全部依赖都有预编译包、PDF 中文用 reportlab 内置 STSong-Light） | 实测依据：PyPI 与阿里云镜像均提供 `ifcopenshell 0.9.0 py311 manylinux_2_31_x86_64` wheel（匹配 python:3.11-slim），无需编译工具链；锁文件 299 条下载地址本指向 registry.npmjs.org（`npm config set registry` 不会覆盖它），只在打包副本中改写为 registry.npmmirror.com，仓库原锁文件保持不动以免影响桌面端开发；打包脚本把 `ARCHIKEN_BUILD_ID` 回写进 `.env`（否则云端 `/health` 永远报 dev-local，三端版本锚点失效），且以无 BOM 的 UTF-8 写回避免 docker compose 读 .env 报错；修复 PS5 下无 BOM 中文脚本被按 ANSI 解析失败、以及 `$ErrorActionPreference='Stop'` 把 npm 的 stderr 警告误判为致命错误；最终产物校验：14 项必需文件齐全、锁文件 npmmirror=299/npmjs=0、构建号 `1407608-20261015142426` 已注入、前端 hash ClcKggP5、无 `__pycache__` 残留 |
| 2026-10-15 | readme.md + .gitignore | readme 目录结构补 `deploy/` 条目、目录列表加「十二、云端部署与版本同步」、文末追加该中英双语章节（模式表 / 架构图 / 部署文件表 / 五步上线 / API Key 说明 / 版本一致性锚点）；.gitignore 追加 `deploy/_stage/`、`deploy/_build.log`、`deploy/archiken-deploy.zip` | 规则 3「结构改动同步更新 readme」；zip 属可再生成的交付产物，不入库以免仓库膨胀 |
| 2026-10-15 | src/services/transport.ts + deploy/build-deploy-zip.ps1 + deploy/DEPLOY_ON_BT_PANEL.md + readme.md | 云端访问地址定为主站子路径 `https://www.kbitai.com.cn/aitools/aichiken/`：① transport.ts 新增 `VITE_ARCHIKEN_API_PREFIX`（默认空串不影响单机/开发版），PROXY_PREFIX 改为 `${API_PREFIX}/api/kernel|server`；② 打包脚本注入 `VITE_ARCHIKEN_API_PREFIX=/aitools/aichiken`，并修前端 hash 提取正则（rollup hash 含 `_` 导致原 `[A-Za-z0-9]+` 匹配失败显示 unknown）；③ 部署指南第 3~5 步重写为子路径方案（先生成 htpasswd 密码文件 → 主站配置文件末尾粘贴子路径块含三处 Basic Auth → SSL 复用主站证书跳过 → 新 healthz 验证地址），常见问题表同步修正；④ readme 十二章上线流程/传输方式/healthz 地址改为子路径版 | 前端产物实测包内已含 `/aitools/aichiken` 前缀（`const vm="/aitools/aichiken"` 拼接 kernel/server 前缀）；重建 zip：构建号 b69daeb-20261015144603、前端 hash Bn023k1_、6.8MB、14 项校验通过；主站为公开官网不能整站开认证，只在 aichiken 三个 location 内加 Basic Auth |
| 2026-10-15 | deploy/DEPLOY_ON_BT_PANEL.md + readme.md | 云端网页版改为**开放访问**（用户要求暂时不要密码）：指南第 3 步去掉三处 `auth_basic` 及密码文件先行步骤（3.2 重编号为 3.1），第 5 步验证描述去掉登录框，文末新增「可选：开启密码访问」两小节（htpasswd 生成 + 三个 location 各加两行，取消则删两行）；readme 上线流程与 API Key 段落同步为「默认开放、可选 Basic Auth」 | 另发现项目目录内被 IDE 误建一个空 .git（无任何提交，致打包脚本 git rev-parse 报 Needed a single revision），已删除，所有历史仍在 kbitai_com_cn 主仓库；重建 zip：构建号 3d78ba2-20261015150655、前端 hash Bn023k1_ 不变 |
| 2026-10-15 | 删除 aitools/Achi_Ken/ArchiKen/ + aitools/Achi_Ken/archi_ken/（磁盘 + git 索引） | 清理误 clone 进项目目录的两个无关嵌套仓库：ArchiKen/ 是另一个项目（OpenBIM-AI 算量平台，远程 github.com/archilau0315/ArchiKen，最新提交 d06ec45 已确认在 origin/main 上，457MB）；archi_ken/ 是空仓库 clone（仅 .gitattributes 一个 Initial commit）。两者在主仓库里只是误提交的 gitlink（160000）条目，无 .gitmodules | 删除后主仓库 gitlink 条目一并移除，本项目代码对这两目录零引用 |
| 2026-10-15 | deploy/build-deploy-zip.ps1 + deploy/DEPLOY_ON_BT_PANEL.md + readme.md | 服务器目录统一收进 `archi_ken/` 父目录（用户要求便于管理）：zip 内结构改为 `archi_ken/archiken`（后端）+ `archi_ken/archiken-web`（前端）+ `archi_ken/部署指南-宝塔面板.md`，校验清单 14 项同步加前缀；指南第 1/2/3 步、常见问题、可选密码节、readme 上线流程的服务器路径全部改为 `/www/wwwroot/archi_ken/...`（含 htpasswd 与 nginx alias） | 重建 zip：构建号 08ff12a-20261015152724、前端 hash Bn023k1_ 不变；服务器端已解压的旧两目录用 `mkdir archi_ken && mv archiken archiken-web archi_ken/` 一条命令归位即可，无需重传 |
| 2026-10-15 | deploy/build-deploy-zip.ps1 + deploy/DEPLOY_ON_BT_PANEL.md + readme.md | 服务器部署目录再调整（用户要求）：由 `/www/wwwroot/archi_ken/` 改为主站目录下 `/www/wwwroot/kbitai.com.cn/aitools/{archiken,archiken-web}`，zip 去掉父目录包装恢复两目录平铺；指南第 1 步改为在 `kbitai.com.cn` 下新建 `aitools` 文件夹再上传解压；nginx 子路径块**新增安全规则** `location ^~ /aitools/archiken/ { deny all; }`（后端源码和 .env 在网站目录下，禁止公网直接下载，应用 API 不受影响）；htpasswd/alias/cd 等全部路径同步 | 重建 zip：构建号 d240806-20261015153215、前端 hash Bn023k1_ 不变 |
| 2026-10-15 | deploy/build-deploy-zip.ps1 + deploy/DEPLOY_ON_BT_PANEL.md + readme.md | 部署目录定稿（用户明确）：`/www/wwwroot/kbitai.com.cn/aitools/archi_ken/{archiken,archiken-web}`——主站 aitools 下再用 archi_ken 作前后端父目录；zip 恢复 archi_ken 父目录包装（上传 aitools 解压即得），nginx deny 规则改为 `^~ /aitools/archi_ken/`（URL 空间与实际目录对应，与应用路径 /aitools/aichiken/ 无冲突） | 重建 zip：构建号 341fd26-20261015154300、前端 hash Bn023k1_ 不变 |
| 2026-10-15 | 服务器上线（无代码改动） | ArchiKen 云端网页版**正式上线**：阿里云 47.93.210.248 宝塔面板，`/www/wwwroot/kbitai.com.cn/aitools/archi_ken/{archiken,archiken-web}`；踩坑一处——Docker Hub 官方源超时，`/etc/docker/daemon.json` 合并多个国内镜像加速器（daocloud 优先 + 原阿里云个人加速器）后构建成功；双容器 healthy（kernel 4319 / server 4318 仅绑 127.0.0.1），主站 Nginx 配置块粘贴完成 | 版本锚点一致：healthz 公网返回 `{"version":"0.12.0","build":"3d78ba2-20261015150655"}`，前端产物 hash `Bn023k1_`（页面 HTTP 200、JS 800KB 200），访问地址 https://www.kbitai.com.cn/aitools/aichiken/ 开放访问无密码 |
| 2026-10-15 | deploy/build-deploy-zip.ps1 + src/services/transport.ts + deploy/DEPLOY_ON_BT_PANEL.md + readme.md | 云端网址定稿为 `https://www.kbitai.com.cn/aitools/archiken/`（用户纠正拼写 aichiken→archiken）：打包脚本 `VITE_ARCHIKEN_API_PREFIX`、transport 注释、指南与 readme 全部 URL 同步替换；nginx deny 规则保持 `^~ /aitools/archi_ken/` 不动（与应用新路径 archiken 无冲突，仍保护后端目录） | 另修复打包脚本文件头被 IDE 叠出 5 个 BOM 导致首行解析报错（剥至单 BOM）；重建 zip：构建号 c12a3df-20261015161708、**新前端 hash z7-DGE4x**（前缀字符串变了 hash 必变） |
| 2026-10-15 | vite.config.ts + src/types.d.ts + src/App.tsx + src/styles.css | 顶栏左上角品牌区加版本号：vite 构建期从 package.json 读 version 注入 `__APP_VERSION__` 全局常量（types.d.ts 补声明），App.tsx 品牌名右侧渲染 `v0.1.0` 小圆角徽章（等宽字体 + 细边框） | 用户要求；typecheck + build 通过，产物中确认含版本字符串与 version 样式类 |
| 2026-10-15 | src/services/transport.ts + src/services/kernel.ts | 修云端上传 404：`uploadModelFile` 裸 fetch 硬编码 `/api/server/upload`，绕过了 transport 层的 `VITE_ARCHIKEN_API_PREFIX` 子路径前缀；transport.ts 新增导出 `apiUrl(target, path)`，kernel.ts 上传改用 `apiUrl('server','/upload')` | 云端实测 POST 打到主站根路径 404 定位；全 src 仅此处裸 fetch；typecheck 通过，重建 zip 构建号 d048172-20261015211059、前端 hash DSr_2vTW，产物确认旧字面量消失、调用改为 apiUrl 拼接 |
