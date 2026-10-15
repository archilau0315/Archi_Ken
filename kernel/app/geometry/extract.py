"""构件几何提取。

基于 IfcOpenShell 几何内核把构件三角化为世界坐标网格，并计算轴对齐包围盒，
作为碰撞检测与规则判定的公共底座。结果按模型指纹缓存到 .kengeo。

对多材质构件（如玻璃幕墙含玻璃面板与金属框料），按材质拆分为多个子条目，
使框料与玻璃可独立识别、选中与着色。
"""

from __future__ import annotations

import re
from pathlib import Path

import ifcopenshell
import ifcopenshell.geom
import ifcopenshell.util.element

from app.geometry import cache

_settings = ifcopenshell.geom.settings()
try:
    _settings.set(_settings.USE_WORLD_COORDS, True)
except AttributeError:
    _settings.set("use-world-coords", True)

_STYLE_ID_RE = re.compile(r"-(\d+)$")


def bbox_of(verts: list[float]) -> list[float]:
    """由扁平顶点数组 [x,y,z,...] 计算 [minx,miny,minz,maxx,maxy,maxz]。"""
    if not verts:
        return [0.0] * 6
    xs, ys, zs = verts[0::3], verts[1::3], verts[2::3]
    return [min(xs), min(ys), min(zs), max(xs), max(ys), max(zs)]


def _discipline_key(element, model_hint: str = "other") -> str:
    """构件专业 key（延迟导入，避免 geometry 与 federation 包形成导入环）。

    交由专业分类规则统一判定（带文件名模型提示，与融合模式口径一致），
    使几何接口也能按专业分组（如淡化外壳看内部管线）；
    个别构件分类异常时兜底 "other"，不拖垮整体提取。
    """
    from app.federation.discipline import classify_element
    try:
        return classify_element(element, model_hint)["key"]
    except Exception:
        return "other"


def _style_rendering_id(style) -> int | None:
    """从 shape material 的 name（如 IfcSurfaceStyleRendering-858）提取 IFC 实体 id。"""
    name = getattr(style, "name", None)
    if not name:
        return None
    match = _STYLE_ID_RE.search(name)
    return int(match.group(1)) if match else None


def _material_name_map(element) -> dict[int, str]:
    """建立 IfcSurfaceStyleRendering 实体 id → 材质名 的映射。

    链路：IfcMaterialConstituentSet → Material → HasRepresentation(IfcMaterialDefinitionRepresentation)
    → Representations(IfcStyledRepresentation) → Items(IfcStyledItem) → Styles(IfcSurfaceStyle)
    → Styles(IfcSurfaceStyleRendering)。
    用 rendering id 而非 SurfaceStyle id，是因为 shape.material.name 中携带的是 rendering id。
    """
    mat = ifcopenshell.util.element.get_material(element)
    name_map: dict[int, str] = {}
    if not mat:
        return name_map
    constituents = mat.MaterialConstituents if mat.is_a("IfcMaterialConstituentSet") else []
    materials = [c.Material for c in constituents if c.Material]
    if mat.is_a("IfcMaterial"):
        materials.append(mat)
    for material in materials:
        mat_name = getattr(material, "Name", None)
        if not mat_name:
            continue
        for rel in getattr(material, "HasRepresentation", []) or []:
            for rep in getattr(rel, "Representations", []) or []:
                for item in getattr(rep, "Items", []) or []:
                    if not item.is_a("IfcStyledItem"):
                        continue
                    for surface_style in item.Styles or []:
                        if not surface_style.is_a("IfcSurfaceStyle"):
                            continue
                        for rendering in surface_style.Styles or []:
                            if rendering.is_a("IfcSurfaceStyleRendering"):
                                name_map[rendering.id()] = mat_name
    return name_map


def _material_names(shape, element) -> list[str | None]:
    """按 shape.geometry.materials 顺序返回材质名列表。

    优先通过 IfcSurfaceStyle 实体 id 反查材质集；查不到时按材质集中材质
    出现顺序兜底（第 N 个 style 对应第 N 个材质），最后用 SurfaceStyle.Name。
    """
    name_map = _material_name_map(element)
    # 材质集去重后的材质名顺序（用于顺序兜底）
    mat = ifcopenshell.util.element.get_material(element)
    ordered_names: list[str] = []
    if mat and mat.is_a("IfcMaterialConstituentSet"):
        seen: set[str] = set()
        for c in mat.MaterialConstituents:
            n = c.Material.Name if c.Material else None
            if n and n not in seen:
                seen.add(n)
                ordered_names.append(n)

    names: list[str | None] = []
    for idx, style in enumerate(shape.geometry.materials):
        # 从 name（如 IfcSurfaceStyleRendering-858）提取 rendering id；
        # 不访问 style.instance，因其对默认材质会触发 C++ 层 segfault。
        sid = _style_rendering_id(style)
        # 1. 通过 rendering id 查材质集
        if sid is not None and sid in name_map:
            names.append(name_map[sid])
            continue
        # 2. 按材质集顺序兜底
        if idx < len(ordered_names):
            names.append(ordered_names[idx])
            continue
        # 3. 用 style.name 去前缀
        raw = getattr(style, "name", None)
        names.append(raw.split("-", 1)[0] if raw and "-" in raw else raw)
    return names


def _material_colors(shape) -> list[str | None]:
    """从三角化结果读取 IFC 原生表面颜色（IfcStyledItem，设计软件导出时的面色）。

    IfcOpenShell 的 geometry.materials 是 style 对象列表：
    - 真样式的 name 形如 "IfcSurfaceStyleRendering-<id>"，颜色取 diffuse.components
      （(r, g, b) 三元组，0~1 浮点）；
    - 无样式构件会得到一个默认 style（name 为 IFC 类型名，色为内置默认灰），
      视为无颜色返回 None，由前端回退类型色。
    """
    colors: list[str | None] = []
    for style in shape.geometry.materials:
        rgb: str | None = None
        name = getattr(style, "name", None)
        if isinstance(name, str) and name.startswith("IfcSurfaceStyle"):
            try:
                r, g, b = (float(v) for v in style.diffuse.components)
                if 0.0 <= r <= 1.0 and 0.0 <= g <= 1.0 and 0.0 <= b <= 1.0:
                    rgb = "#{:02x}{:02x}{:02x}".format(
                        round(r * 255), round(g * 255), round(b * 255)
                    )
            except (AttributeError, TypeError, ValueError):
                rgb = None
        colors.append(rgb)
    return colors


def _split_by_material(
    verts: list[float],
    faces: list[int],
    material_ids: list[int],
    material_names: list[str | None],
    style_colors: list[str | None],
) -> dict[int, tuple[list[float], list[int], str | None, str | None]]:
    """按材质 id 分组面，返回 {mat_id: (verts, faces, material_name, color)}。"""
    groups: dict[int, list[int]] = {}
    for fi, mid in enumerate(material_ids):
        groups.setdefault(mid, []).append(fi)

    result: dict[int, tuple[list[float], list[int], str | None, str | None]] = {}
    for mid, face_indices in groups.items():
        used: set[int] = set()
        for fi in face_indices:
            base = fi * 3
            used.add(faces[base])
            used.add(faces[base + 1])
            used.add(faces[base + 2])
        old_to_new = {old: new for new, old in enumerate(sorted(used))}
        new_verts: list[float] = []
        for old in sorted(used):
            new_verts.extend(verts[old * 3 : old * 3 + 3])
        new_faces: list[int] = []
        for fi in face_indices:
            base = fi * 3
            new_faces.append(old_to_new[faces[base]])
            new_faces.append(old_to_new[faces[base + 1]])
            new_faces.append(old_to_new[faces[base + 2]])
        name = material_names[mid] if mid < len(material_names) else None
        color = style_colors[mid] if mid < len(style_colors) else None
        result[mid] = (new_verts, new_faces, name, color)
    return result


def extract_entry(element, model_hint: str = "other") -> dict[str, dict]:
    """三角化单个构件；多材质按材质拆分为多个子条目。

    返回 {guid: entry}；单材质构件返回 {GlobalId: entry}，
    多材质构件返回 {GlobalId#m0, GlobalId#m1, ...}。
    """
    try:
        shape = ifcopenshell.geom.create_shape(_settings, element)
    except (RuntimeError, ValueError):
        return {}
    geo = shape.geometry
    verts = list(geo.verts)
    if not verts:
        return {}

    ifc_type = element.is_a()
    discipline_key = _discipline_key(element, model_hint)
    faces = list(geo.faces)
    material_ids = list(geo.material_ids) if hasattr(geo, "material_ids") else []
    style_colors = _material_colors(shape)

    # 无材质 id 或材质种类 ≤ 1：不拆分
    unique_mats = set(material_ids)
    if not material_ids or len(unique_mats) <= 1:
        mat_name = None
        if material_names := _material_names(shape, element):
            mat_name = material_names[0]
        return {
            element.GlobalId: {
                "ifc_type": ifc_type,
                "discipline": discipline_key,
                "bbox": bbox_of(verts),
                "verts": verts,
                "faces": faces,
                "material": mat_name,
                "parent_guid": None,
                "color": style_colors[0] if style_colors else None,
            }
        }

    # 多材质：按面分组拆分
    material_names = _material_names(shape, element)
    groups = _split_by_material(verts, faces, material_ids, material_names, style_colors)
    result: dict[str, dict] = {}
    for mid, (sub_verts, sub_faces, name, color) in groups.items():
        sub_guid = f"{element.GlobalId}#m{mid}"
        result[sub_guid] = {
            "ifc_type": ifc_type,
            "discipline": discipline_key,
            "bbox": bbox_of(sub_verts),
            "verts": sub_verts,
            "faces": sub_faces,
            "material": name,
            "parent_guid": element.GlobalId,
            "color": color,
        }
    return result


def extract_all(model: ifcopenshell.file, model_hint: str = "other") -> dict[str, dict]:
    """提取模型内所有 IfcProduct 的几何（多材质构件拆分为子条目）。"""
    entries: dict[str, dict] = {}
    for element in model.by_type("IfcProduct"):
        entries.update(extract_entry(element, model_hint))
    return entries


def load_or_extract(model: ifcopenshell.file, path: str) -> tuple[dict[str, dict], bool]:
    """优先读缓存；未命中则提取并写缓存。返回 (几何表, 是否命中缓存)。"""
    stat = Path(path).stat()
    file = cache.cache_path(path, stat.st_mtime_ns, stat.st_size)
    entries = cache.load(file)
    if entries is not None:
        return entries, True
    # 文件名模型提示与融合模式一致，保证几何接口与融合数据的专业口径统一。
    from app.federation.discipline import classify_model
    hint = classify_model(Path(path).name)["key"]
    entries = extract_all(model, hint)
    cache.save(file, entries)
    return entries, False
