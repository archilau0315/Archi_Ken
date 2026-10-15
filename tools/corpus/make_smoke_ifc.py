"""生成自建冒烟模型，供内核解析 / 几何 / 碰撞 / 规则 / 融合服务本地验证。

用法：
    python tools/corpus/make_smoke_ifc.py
输出：
    corpus/samples/_smoke/smoke-ifc4.ifc          主冒烟模型（建筑+规则构件）
    corpus/samples/_smoke/smoke-structural-ifc4.ifc  第二模型源（结构+一段风管），供融合验证

说明：模型完全自建（项目 + 场地 + 单体 + 楼层），不涉及任何第三方专有数据。
主冒烟模型分两组构件：
- 墙体组：4 面墙，刻意包含面接触（墙-001↔墙-002）、体积相交（墙-001↔墙-003）、
  完全分离（墙-004）。
- 规则组：门（宽度不足）、楼板 + 梁（梁板净空不足）、两根重合立柱（重复构件）、
  两根相邻管道（间距不足）、一根风管（与墙-004 跨专业碰撞）。
- 合规组（M5）：房间空间（位于梁下方，净高不足）、走道空间（净宽不足，净高充足）。
第二模型源（文件名含 structural → 模型专业推断为「结构」）放在 X≈60 处，
含结构柱 / 结构梁 / 基础 + 一段暖通风管，用于验证融合、专业分类与坐标并置。
"""

from __future__ import annotations

from pathlib import Path

import ifcopenshell
import ifcopenshell.api.aggregate
import ifcopenshell.api.context
import ifcopenshell.api.geometry
import ifcopenshell.api.project
import ifcopenshell.api.pset
import ifcopenshell.api.root
import ifcopenshell.api.spatial
import ifcopenshell.api.unit

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "corpus" / "samples" / "_smoke" / "smoke-ifc4.ifc"
OUTPUT_STRUCT = ROOT / "corpus" / "samples" / "_smoke" / "smoke-structural-ifc4.ifc"

# (名称, 长度 m, 高度 m, 厚度 m, X 偏移 m)
WALLS = [
    ("墙-001", 5.0, 3.0, 0.2, 0.0),   # X 0..5
    ("墙-002", 4.0, 3.0, 0.2, 5.0),   # X 5..9，与 墙-001 面接触
    ("墙-003", 2.0, 3.0, 0.2, 2.0),   # X 2..4，与 墙-001 体积相交（硬碰撞）
    ("墙-004", 4.0, 3.0, 0.2, 12.0),  # X 12..16，孤立，仅被风管穿过
]


def _matrix(x: float, y: float, z: float) -> tuple:
    """平移矩阵：(x,y,z) 为构件局部原点在世界坐标下的位置。"""
    return ((1.0, 0.0, 0.0, x), (0.0, 1.0, 0.0, y), (0.0, 0.0, 1.0, z), (0.0, 0.0, 0.0, 1.0))


def _add_box(model, body, storey, ifc_class, name, size, offset, pset=None):
    """按 (长 X, 高 Z, 厚 Y) 生成盒体构件并放到 offset=(x,y,z)。"""
    length, height, thickness = size
    element = ifcopenshell.api.run("root.create_entity", model, ifc_class=ifc_class, name=name)
    representation = ifcopenshell.api.run(
        "geometry.add_wall_representation", model, context=body, length=length, height=height, thickness=thickness
    )
    ifcopenshell.api.run("geometry.assign_representation", model, product=element, representation=representation)
    ifcopenshell.api.run("geometry.edit_object_placement", model, product=element, matrix=_matrix(*offset))
    if ifc_class == "IfcSpace":  # 空间按空间分解挂到楼层，其它构件按包含关系挂载
        ifcopenshell.api.run("aggregate.assign_object", model, products=[element], relating_object=storey)
    else:
        ifcopenshell.api.run("spatial.assign_container", model, products=[element], relating_structure=storey)
    if pset:
        pset_name, properties = pset
        created = ifcopenshell.api.run("pset.add_pset", model, product=element, name=pset_name)
        ifcopenshell.api.run("pset.edit_pset", model, pset=created, properties=properties)
    return element


def _setup_spatial(model, project_name, storey_name):
    """创建 Project → Site → Building → Storey 层级与几何上下文，返回 (storey, body)。"""
    project = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcProject", name=project_name)
    ifcopenshell.api.run("unit.assign_unit", model, length={"is_metric": True, "raw": "METERS"})

    site = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcSite", name="场地")
    building = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcBuilding", name="单体")
    storey = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcBuildingStorey", name=storey_name)

    ifcopenshell.api.run("aggregate.assign_object", model, products=[site], relating_object=project)
    ifcopenshell.api.run("aggregate.assign_object", model, products=[building], relating_object=site)
    ifcopenshell.api.run("aggregate.assign_object", model, products=[storey], relating_object=building)

    model_context = ifcopenshell.api.run("context.add_context", model, context_type="Model")
    body = ifcopenshell.api.run(
        "context.add_context",
        model,
        context_type="Model",
        context_identifier="Body",
        target_view="MODEL_VIEW",
        parent=model_context,
    )
    return storey, body


def build_model() -> ifcopenshell.file:
    model = ifcopenshell.api.run("project.create_file", version="IFC4")
    storey, body = _setup_spatial(model, "ArchiKen 冒烟工程", "一层")

    for name, length, height, thickness, offset_x in WALLS:
        wall = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcWall", name=name)
        representation = ifcopenshell.api.run(
            "geometry.add_wall_representation",
            model,
            context=body,
            length=length,
            height=height,
            thickness=thickness,
        )
        ifcopenshell.api.run("geometry.assign_representation", model, product=wall, representation=representation)
        ifcopenshell.api.run("geometry.edit_object_placement", model, product=wall, matrix=_matrix(offset_x, 0.0, 0.0))
        ifcopenshell.api.run("spatial.assign_container", model, products=[wall], relating_structure=storey)

        pset = ifcopenshell.api.run("pset.add_pset", model, product=wall, name="Pset_WallCommon")
        ifcopenshell.api.run(
            "pset.edit_pset",
            model,
            pset=pset,
            properties={"IsExternal": True, "FireRating": "EI60", "LoadBearing": True},
        )

    # —— 规则引擎冒烟构件（远离墙体簇；仅风管刻意与 墙-004 相交）——
    _add_box(model, body, storey, "IfcDoor", "门-D01", (0.9, 2.1, 0.1), (20.0, 0.0, 0.0),
             pset=("Pset_DoorCommon", {"OverallWidth": 0.7, "IsExternal": False}))
    _add_box(model, body, storey, "IfcSlab", "楼板-S1", (4.0, 0.2, 3.0), (30.0, 0.0, 3.0))
    _add_box(model, body, storey, "IfcBeam", "梁-B1", (4.0, 0.2, 0.3), (30.0, 0.0, 2.3))
    _add_box(model, body, storey, "IfcMember", "立柱-C1", (0.3, 3.0, 0.3), (40.0, 0.0, 0.0))
    _add_box(model, body, storey, "IfcMember", "立柱-C2", (0.3, 3.0, 0.3), (40.0, 0.0, 0.0))
    _add_box(model, body, storey, "IfcPipeSegment", "管-P1", (2.0, 0.1, 0.1), (50.0, 0.0, 0.0))
    _add_box(model, body, storey, "IfcPipeSegment", "管-P2", (2.0, 0.1, 0.1), (50.0, 0.15, 0.0))
    _add_box(model, body, storey, "IfcDuctSegment", "风管-D2", (5.0, 0.4, 0.4), (13.0, 0.0, 1.0))

    # —— 合规组（M5）：空间（净高 / 净宽）——
    _add_box(model, body, storey, "IfcSpace", "房间-SP1", (4.0, 2.2, 3.0), (30.0, 0.0, 0.0))
    _add_box(model, body, storey, "IfcSpace", "走道-SP2", (1.0, 2.4, 3.0), (70.0, 0.0, 0.0))

    return model


def build_structural_model() -> ifcopenshell.file:
    """第二模型源：结构专业（文件名含 structural），另含一段暖通风管以验证构件级分类覆盖。"""
    model = ifcopenshell.api.run("project.create_file", version="IFC4")
    storey, body = _setup_spatial(model, "ArchiKen 冒烟结构工程", "结构层")

    _add_box(model, body, storey, "IfcColumn", "结构柱-KZ1", (0.4, 3.0, 0.4), (60.0, 0.0, 0.0),
             pset=("Pset_ColumnCommon", {"LoadBearing": True, "IsExternal": False}))
    _add_box(model, body, storey, "IfcColumn", "结构柱-KZ2", (0.4, 3.0, 0.4), (66.0, 0.0, 0.0))
    _add_box(model, body, storey, "IfcBeam", "结构梁-KL1", (8.0, 0.3, 0.4), (60.0, 0.0, 3.0))
    _add_box(model, body, storey, "IfcFooting", "基础-CT1", (1.5, 0.4, 1.5), (60.0, 0.0, -0.4))
    _add_box(model, body, storey, "IfcDuctSegment", "暖通风管-AC1", (3.0, 0.4, 0.4), (63.0, 0.0, 2.2))

    return model


def _write(model: ifcopenshell.file, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    model.write(str(output))
    print(f"已生成：{output}")
    print(f"  schema={model.schema} 构件数={len(model.by_type('IfcProduct'))}")


def main() -> None:
    _write(build_model(), OUTPUT)
    _write(build_structural_model(), OUTPUT_STRUCT)


if __name__ == "__main__":
    main()

