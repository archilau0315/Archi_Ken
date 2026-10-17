// 中文词典：帮助面板（用户手册 / 快捷键 / 关于 / 订阅）。
export default {
  'help.title': '帮助',
  'help.tagline': '操作手册 · 版本信息 · 订阅',
  'help.close': '关闭',
  'help.tab.manual': '用户手册',
  'help.tab.shortcuts': '视图操作',
  'help.tab.about': '关于',
  'help.tab.subscribe': '订阅',
  'help.tab.legal': '法律信息',

  'help.manual.s1.title': '1. 快速开始',
  'help.manual.s1.body':
    '① 在左栏「模型源」添加一个或多个 IFC 模型（可点示例模型）。\n② 点击顶栏「加载融合」，多模型按专业自动分类并着色。\n③ 点击「真实模型」构建三维网格，查看构件真实外观与材质。',
  'help.manual.s2.title': '2. 运行检查与问题清单',
  'help.manual.s2.body':
    '点击「运行检查」对第一个模型源执行规则集检查，结果汇总到右下「问题清单」。\n点击问题条目可在 3D 视图中定位并高亮对应构件。',
  'help.manual.s3.title': '3. 碰撞矩阵',
  'help.manual.s3.body':
    '「碰撞矩阵」检测硬碰撞 / 间隙 / 净空 / 重复构件四类冲突。\n点击碰撞项：3D 视图飞到碰撞点、框选双方构件并隔离显示。\n支持自定义构件对选择集、忽略规则、邻近碰撞合并与状态审查。',
  'help.manual.s4.title': '4. 信息提取（工程量）',
  'help.manual.s4.body':
    '「信息提取」按模板统计构件的面积 / 体积 / 表面积等工程量。\n复合墙自动按构造层拆分明细：结构层按体积、抹灰 / 保温层按面积，洞口自动扣减。\n支持按楼层 / 类型 / 构造层角色 / 材质 / 自定义列分组小计。',
  'help.manual.s5.title': '5. IDS 校验',
  'help.manual.s5.body':
    '「IDS 校验」按 buildingSMART IDS 规范核查构件属性合规性。\n失败项可一键转为问题单，进入沟通流程跟踪。',
  'help.manual.s6.title': '6. 报告导出',
  'help.manual.s6.body':
    '「报告」汇总检查结果与碰撞问题，支持 HTML / PDF / Excel 三种格式。\n报告附构件 GUID 与碰撞点坐标，便于溯源。',
  'help.manual.s7.title': '7. 沟通与 BCF',
  'help.manual.s7.body':
    '「沟通」面板管理问题单全生命周期（新建 / 确认 / 解决 / 关闭）。\n支持视图快照、评论与 BCF 2.1 导入导出，可与 Solibri / Revit 生态互换。',
  'help.manual.s8.title': '8. 视图工具',
  'help.manual.s8.body':
    '「视图」面板提供剖切、透视外壳、预设视角（顶 / 前 / 后 / 左 / 右）与正交投影切换。\n左栏可在「专业分类」与「原始颜色」两种着色模式间切换。',

  'help.shortcuts.s1.keys': '左键拖动',
  'help.shortcuts.s1.desc': '旋转模型',
  'help.shortcuts.s2.keys': '右键拖动',
  'help.shortcuts.s2.desc': '平移视图',
  'help.shortcuts.s3.keys': '滚轮',
  'help.shortcuts.s3.desc': '缩放',
  'help.shortcuts.s4.keys': '单击构件',
  'help.shortcuts.s4.desc': '选中并查看属性',
  'help.shortcuts.s5.keys': '单击空白',
  'help.shortcuts.s5.desc': '取消选中',
  'help.shortcuts.s6.keys': '点击剖切轴',
  'help.shortcuts.s6.desc': '开关该方向剖切（视图面板）',
  'help.shortcuts.s7.keys': '点击碰撞项',
  'help.shortcuts.s7.desc': '飞到碰撞点并隔离双方构件',
  'help.shortcuts.s8.keys': 'F1',
  'help.shortcuts.s8.desc': '打开本帮助面板',

  'help.about.version': '版本 v{v}',
  'help.about.stack': '技术架构',
  'help.about.stackValue': 'Electron + React 界面 · Python FastAPI 内核（IfcOpenShell）· Node 业务服务',
  'help.about.license': '许可',
  'help.about.licenseValue': '内部使用（未发布）',
  'help.about.feedback': '问题反馈',
  'help.about.feedbackValue': '请在「沟通」面板创建问题单，或联系项目组',
  'help.about.update': '检查更新',
  'help.about.checkBtn': '立即检查',
  'help.about.checking': '检查中…',
  'help.about.latest': '当前已是最新版本',

  'help.subscribe.title': '订阅（即将推出）',
  'help.subscribe.body1': '当前版本为内部测试版，全部功能免费开放。',
  'help.subscribe.body2': '正式版将提供以下订阅档位：',
  'help.subscribe.f1': '基础版：模型检查 + 碰撞矩阵 + 报告导出',
  'help.subscribe.f2': '专业版：+ IDS 校验 + 信息提取 + BCF 协同',
  'help.subscribe.f3': '团队版：+ 多人协作 + 规则集共享 + 优先支持',
  'help.subscribe.note': '订阅功能尚未开放，敬请期待。',

  'help.legal.title': '法律信息',
  'help.legal.placeholder': '隐私政策与最终用户许可协议（EULA）将随正式版发布补充于此。',
}
