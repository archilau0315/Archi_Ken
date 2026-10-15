"""简化规则引擎子包：规则 DSL、求值器与内置模板。

模块划分：
- dsl.py        规则定义的结构化解析与校验
- operators.py  算子（比较运算、单位换算），纯函数
- selector.py   按 IFC 类型与属性条件筛选目标构件
- checks.py     四类检查实现（属性 / 相交 / 净距 / 重复）
- evaluator.py  求值编排与结果原因链
- templates.py  5 个内置规则模板
"""
