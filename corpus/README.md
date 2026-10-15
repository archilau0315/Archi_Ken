# 回归语料库

计划工作包 1.1 的落地目录。语料库用于**对标基准比对**与**兼容性回归**，是第 2–5 阶段全部验收动作的输入。

---

## 一、覆盖矩阵

语料库需覆盖 **4 个 IFC 版本 × 4 个导出方 × 4 个规模档 = 64 个格子**，每个格子至少 1 个可用样本。

| 维度 | 取值 |
|---|---|
| IFC 版本 | `IFC2X3` / `IFC4` / `IFC4X1` / `IFC4X3` |
| 导出方 | `Revit` / `ArchiCAD` / `Tekla` / `Bentley` |
| 规模档 | `small`(≤10MB) / `medium`(~100MB) / `large`(~500MB) / `xlarge`(≥1GB) |

截至阶段一交付要求：4 个维度取值全覆盖，**每个格子 ≥ 3 个可用样本**。

---

## 二、目录与命名规范

```
corpus/
├─ README.md              本文件
├─ manifest.json          语料清单（唯一索引，脚本据此统计覆盖率）
├─ samples/               样本文件存放区（大文件不入 git，见下）
│   └─ <导出方>/<版本>/<规模档>-<序号>.ifc
└─ probes/                探针模型（工作包 1.4 用，规则判定边界验证）
    └─ <规则模板名>/<边界>-<序号>.ifc
```

命名示例：`samples/Revit/IFC4/medium-01.ifc`

**大文件策略**：`samples/` 下超过 10MB 的样本不入 git（见根目录 `.gitignore`），只提交 `manifest.json`；样本本体另行分发或使用脚本下载。

---

## 三、添加样本

1. 将 IFC 文件放入 `samples/<导出方>/<版本>/` 目录。
2. 在 `manifest.json` 的 `samples` 数组中追加一条记录：

```json
{
  "id": "Revit-IFC4-medium-01",
  "file": "samples/Revit/IFC4/medium-01.ifc",
  "ifc_version": "IFC4",
  "exporter": "Revit",
  "size_tier": "medium",
  "size_bytes": 104857600,
  "elements": 0,
  "note": "来源/用途备注",
  "added_at": "2026-10-13"
}
```

3. 运行校验脚本确认格式与覆盖度：

```powershell
python tools/corpus/check_manifest.py
```

---

## 四、样本来源建议

- buildingSMART 官方 IFC 样例与认证测试文件
- 开源样例工程（各导出方官方示例模型）
- 内部历史项目模型（需脱敏后入库）
- 必要时采购/搜集行业样本（对应计划假设 A3）

---

## 五、合规要求

样本仅用于**功能对标的输入**。不得将其用于逆向 Solibri 程序二进制；探针模型须为自建模型。
