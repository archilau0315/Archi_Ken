# Solibri 公开规则 → ArchiKen 缺口对照表

> 版本：v1 · 2026-10-15
> 来源：Solibri 官方公开帮助文档（help.solibri.com → Solibri Rules → Rule Templates，共 63 条模板 + "How to Choose the Appropriate Rule" 用途索引）
> 合规边界：仅对标公开文档中的规则编号/名称/检查意图，不复制其实现与参数；ArchiKen 规则的权威依据为现行 GB 规范。

## 档位定义

| 档位 | 含义 |
|---|---|
| ✅ 已覆盖 | ArchiKen 现有 80 条模板中已有等价规则（部分覆盖注明） |
| 🔧 可表达 | 现有 DSL v1（property/intersection/clearance/duplicate/headroom/dimension）可直接编写，待补 |
| 🚧 需扩展 | 需要 Phase B 引擎新能力（count 计数 / containment 包含 / any_of OR / max-distance 上限距离等） |
| ➖ 不适用 | 非规则引擎范畴（版本对比、人工检查、视图功能、外部标准对接、领域外） |

## 一、逐条对照（63 条）

### 碰撞与几何

| Solibri 规则 | 检查意图 | 档位 | ArchiKen 对应 / 说明 |
|---|---|---|---|
| 01 General Intersection | 构件相交/碰撞、重复构件、重叠量统计 | ✅ | clash-interdisciplinary、wall-window-intersection、mep-pipe/duct-beam-crossing、mep-pipe-cable-crossing、struct-beam-door-intersection |
| 222 Component Distance | 构件净距（安全/无障碍/防碰撞） | ✅ | clearance 类型全面对应：beam-slab-headroom、duct-slab-clearance、mep-duct-cable-clearance、mep-sprinkler-beam-clearance、fire-sprinkler-clearance |
| 221 Wall Distance | 平行承重墙间距（跨度上限） | 🚧 | 现有 clearance 只检"过近"；"间距不得超过上限"需 max-distance 能力 |
| 223 Structural Components Fit in Architectural Ones | 结构构件嵌入建筑构件 | 🚧 | containment 包含关系 |
| 224 Architectural Components Are Filled | 建筑构件被填充 | 🚧 | containment 包含关系 |
| 234 Component Inside Component | 构件内嵌构件 | 🚧 | containment 包含关系 |
| 23 Components Must Touch Other Components | 柱顶必须接触板/梁（反向净距） | 🚧 | 需"必须接触"反向语义或 touch 检查 |
| 233 Allowed Beam Intersections | 梁允许相交白名单（反向） | 🚧 | 需相交白名单（非违规对排除）能力 |
| 218 Element Hole Validation | 梁端开洞距离 | 🔧 | bbox 级近似：开洞与梁净距 clearance（warning 级，本批暂缓，误报风险高） |
| 216 Wall Validation | 门窗洞口距墙顶/板净距等 | 🔧 | 洞口与上方梁板净距可用 clearance 近似（本批暂缓，误报风险高） |

### 属性与数据质量

| Solibri 规则 | 检查意图 | 档位 | ArchiKen 对应 / 说明 |
|---|---|---|---|
| 230 Property Rule with Component Filters | 通用属性检查 | ✅ | property 类型即本体（door-min-width 等全部属性规则） |
| 09 Property Values from Agreed List | 属性值白名单 | ✅ | `in` 算子：fire-wall-rating、opening-fire-window-rating；本批补防火门/窗等级枚举两条 |
| 203 Required Property Sets | 必备属性集/属性 | ✅ | `exists` 算子：struct-column-tag、opening-door-tag、mep-element-tag 等 tag 系列 |
| 21 Unique Identifier | 编号唯一/格式/连续 | ✅ 部分 | duplicate-member、pipe-duplicate 覆盖唯一性；编号连续性需脚本 🚧 |
| 17 Layer from Agreed List | 图层白名单 | 🔧 | 属性 `in` 白名单可表达；IFC 图层使用率低，暂不优先 |
| 171 Property Values Consistent | 同类型构件属性值一致性 | 🚧 | 跨构件一致性比较（同类型墙厚一致等） |
| 231 Comparison Between Property Values | 属性 A 与属性 B 比较 | 🚧 | 跨属性比较能力 |
| 215 Allowed Profiles | 构件截面白名单 | 🔧 | 属性 `in` 白名单可表达（本批以结构尺寸规则近似覆盖） |

### 空间与面积

| Solibri 规则 | 检查意图 | 档位 | ArchiKen 对应 / 说明 |
|---|---|---|---|
| 132 Space Area | 空间面积上下限 | 🔧 | Qto_SpaceBaseQuantities.NetFloorArea 属性比较（本批新增 space.py：卧室/起居室/厨房最小面积） |
| 202 Space Validation | 空间净高、与墙/柱几何对齐 | ✅ 部分 | headroom-room/corridor/bathroom/kitchen/bedroom 等覆盖空间净高；空间与墙柱对齐属几何校验 🚧 |
| 190 Fire Compartment Area within Limits | 防火分区面积限值 | 🔧 | 防火分区建模为空间时按面积属性上限（本批新增 space-fire-compartment-max-area） |
| 111 Floor and Gross Area Analysis | 楼层毛/净面积比率、窗墙比 | 🚧 | 聚合+比率计算 |
| 37 Total Space Area on Each Floor | 每层空间总面积 | 🚧 | 聚合计算 |
| 38 Space Count on Each Floor | 每层空间数量 | 🚧 | count 计数 |
| 36 Space Requirements | 房间表（housing plan）比对 | 🚧 | 外部数据比对（远期接规则集导入） |
| 19 Spaces Must Have Enough Window Area | 窗地比 10%~25% | 🚧 | 比率计算（窗面积/地面面积） |
| 161 Distances Between Spaces | 空间间距离上下限 | 🚧 | 上限距离（"太远"）能力 |
| 241 Space Connection | 空间邻接（厨房邻餐厅等） | 🚧 | 空间邻接关系 |
| 25 Components Connected to Spaces | 门窗必须关联空间 | 🚧 | 空间关联关系 |
| 162 Spaces in Space Groups | 空间必须归属空间组 | 🚧 | 分组归属 |
| 175 Space Group Containment | 户型必须含某类空间 | 🚧 | 空间组包含（count+containment） |
| 191 Spaces in Fire Compartments | 空间必须归入防火分区 | 🚧 | 分组归属 |
| 225 Number of Components in Space | 空间内构件数量 | 🚧 | count + containment |

### 无障碍与疏散

| Solibri 规则 | 检查意图 | 档位 | ArchiKen 对应 / 说明 |
|---|---|---|---|
| 207 Accessible Ramp | 坡道宽/坡度/平台 | ✅ 部分 | access-ramp-width、access-ramp-headroom、access-ramp-landing-depth；坡度比率 🚧 |
| 208 Accessible Door | 门宽/高/门槛/门前空间 | ✅ 部分 | access-door-clear-width、access-opening-height、access-flagged-door-width；门前/侧自由空间 🚧 |
| 209 Free Floor Space | 卫生间回转空间、走道净宽 | ✅ | access-toilet-turning-space（dimension） |
| 210 Accessible Stair | 楼梯宽/踏步/平台/净空 | ✅ 部分 | access-stair-width、egress-stair-width、egress-stair-platform-width、headroom-stair-flight/platform；踏步级数与踢踏面比 🚧 |
| 211 Accessible Window | 窗台高度 | 🔧 | 窗台高属性名无统一约定，按项目约定属性编写（info 级，本批暂缓） |
| 238 Accessible Route | 无障碍路线连通 | 🚧 | 路径分析（远期） |
| 246 Accessible Space | 无障碍空间尺寸 | ✅ 部分 | access-* 域已覆盖空间尺寸类 |
| 247 Local Accessible Circulation | 局部通行宽度 | 🚧 | 通行宽度几何分析 |
| 248 Accessible Area around Objects | 物体周围无障碍区域 | 🚧 | 自由空间几何分析 |
| 252 Accessible Route Compliance | 无障碍路线合规 | 🚧 | 路径分析（远期） |
| 179 Escape Route Analysis | 疏散路径长度/可选路径 | 🚧 | 路径分析（远期） |
| 243 Exit Access Doorway Arrangement | 安全出口分散布置、间距 ≥5m | 🔧 | clearance 同集合两两净距（本批新增 egress-exit-door-spacing）；出口数量 ≥2 需 count 🚧 |
| 209/226 Free Area in Front | 构件前方自由区域 | 🚧 | 自由空间几何分析 |
| 236 Guarded Against Falling | 临边防护（栏杆） | 🔧 部分 | 本批新增 guard.py：栏杆/扶手高度（dimension axis z）；临边判定几何 🚧 |
| 237 Parking Rule | 车位尺寸/净高/数量 | ✅ 部分 | headroom-parking-bay、access-parking-min-dim；车位计数 🚧 |

### 消防专项

| Solibri 规则 | 检查意图 | 档位 | ArchiKen 对应 / 说明 |
|---|---|---|---|
| 172 Fire Walls Correct Types | 防火墙上门窗类型与墙等级匹配 | ✅ 部分 | fire-wall-rating、fire-door-rating、egress-fire-door-rating 覆盖等级属性；墙-门窗等级匹配需跨构件比较 🚧 |
| 212 Building Envelope Validation | 外围护有效性 | 🚧 | 外围护拓扑分析 |
| 242 Building Envelope Rule | 外围护规则 | 🚧 | 外围护拓扑分析 |
| 240 Effective Coverage Area | 喷头覆盖面积 | 🚧 | 覆盖面积分析 |

### 模型结构与其他

| Solibri 规则 | 检查意图 | 档位 | ArchiKen 对应 / 说明 |
|---|---|---|---|
| 11 Model Should Have Components | 模型必须含某类构件 | 🚧 | count 计数（模型级存在性） |
| 176 Model Structure | 门窗有洞口、墙厚=材料层和 | 🚧 | 结构关系校验 |
| 228 Floor Names Consecutive | 楼层命名连续 | 🔧 部分 | 命名规范 matches 可表达（本批新增 quality-storey-naming）；连续性判断需脚本 🚧 |
| 220 Floor Distance | 层高上下限 | 🚧 | 楼层标高差计算 |
| 206 Model Comparison | 模型版本对比 | ➖ | 版本对比功能，非规则引擎范畴 |
| 232 Manual Checking | 人工检查项 | ➖ | 流程功能 |
| 244 IDS Validation | buildingSMART IDS 校验 | ➖ | 外部标准对接（项目既定远期路线） |
| 245 Clash Detection Matrix | 碰撞矩阵 | ✅ 部分 | intersection 集合对即矩阵单元格；矩阵配置 UI 属前端后续 |
| 250 Component Visibility | 构件可见性 | ➖ | 视图功能 |
| 213 Length of Shelves | 货架长度 | ➖ | 零售专用，领域外 |
| 235 Relative Number | 每层/每空间相对数量 | 🚧 | count 计数 |

## 二、统计与结论

| 档位 | 数量 | 占比 |
|---|---|---|
| ✅ 已覆盖（含部分） | 15 | 24% |
| 🔧 可表达待写 | 9 | 14% |
| 🚧 需引擎扩展 | 34 | 54% |
| ➖ 不适用 | 5 | 8% |

### 🚧 档按所需引擎能力归类（决定 Phase B 优先级）

| 引擎能力 | 涉及 Solibri 规则 | 频次 |
|---|---|---|
| containment 包含/归属/关联 | 162、175、191、223、224、234、25、36 | 8 |
| count 计数 | 11、225、235、38、36、243（出口数）、237（车位数） | 7 |
| 路径分析（远期） | 179、238、247、252 | 4 |
| 比率/聚合计算 | 19、111、37、240 | 4 |
| 自由空间几何 | 226、248、236、208（门前空间） | 4 |
| 上限距离 max-distance | 161、221 | 2 |
| 跨属性/跨构件比较 | 231、171、172（匹配部分） | 3 |
| 外围护拓扑 | 212、242 | 2 |
| 反向语义（接触/白名单） | 23、233 | 2 |
| 层高计算 | 220 | 1 |
| 外部数据比对 | 36 | 1 |

**结论**：Phase B 优先实现 **count 计数 + any_of OR 条件组 + containment 包含** 三项，可解锁 🚧 档中最高频缺口；any_of 同时为 🔧 档规则编写去重（如"卫生间或浴室"一条规则覆盖多关键词）。

### 🔧 档落地记录（Phase A②，本批 2026-10-15）

- 132 → space.py：卧室/起居室/厨房最小面积、户内过道净宽（Qto 面积需引擎补 m² 单位换算，随本批一并实现）
- 190 → space-fire-compartment-max-area
- 243 → egress-exit-door-spacing（安全出口间距 ≥5m）
- 236 → guard.py：阳台栏杆净高、楼梯扶手高度、栏杆编号
- 09/215 → opening-fire-door-rating-enum、opening-fire-window-rating-enum（枚举白名单）
- 228 → quality-storey-naming（楼层命名规范，连续性部分留 🚧）
- 216/218（洞口净距 bbox 近似）与 211（窗台高属性名无约定）误报风险高，暂缓至 Phase C 验证后决定
