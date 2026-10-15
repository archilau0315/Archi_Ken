"""模型加载与融合（M1）。

模块划分：
- discipline.py  专业分类（Discipline）自动映射：按命名 / 导出软件 / IFC 类型推断
- merge.py       多 IFC 文件融合为统一视图：构件表、坐标归一、GUID 冲突处理
- tree.py        融合后的模型树：模型 → 空间层级，节点附带专业分布
"""
