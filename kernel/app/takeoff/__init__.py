"""ITO / QTO 信息提取（M6）。

由几何包围盒推导工程量（体积 / 面积 / 长宽高），配合受控表达式
自定义计算列，产出逐构件信息表（ITO），支持导出 Excel。
子模块：columns（列定义）、expr（受控表达式）、quantities（工程量推导）、
extract（提取主流程）、export（Excel 导出）。
"""
