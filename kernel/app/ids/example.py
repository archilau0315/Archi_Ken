"""内置示例 IDS：供界面「载入示例」与冒烟测试使用（自建、符合 IDS 1.0 schema）。"""

from __future__ import annotations

EXAMPLE_TITLE = "筑审通 IDS 示例"

EXAMPLE_XML = """<?xml version="1.0" encoding="UTF-8"?>
<ids:ids xmlns:ids="http://standards.buildingsmart.org/IDS" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://standards.buildingsmart.org/IDS http://standards.buildingsmart.org/IDS/1.0/ids.xsd">
  <ids:info>
    <ids:title>筑审通 IDS 示例</ids:title>
    <ids:version>1.0</ids:version>
    <ids:description>演示用最小 IDS：构件命名与属性完整性检查。</ids:description>
  </ids:info>
  <ids:specifications>
    <ids:specification name="墙体命名规范" ifcVersion="IFC4" description="墙构件必须有名称属性">
      <ids:applicability minOccurs="1" maxOccurs="unbounded">
        <ids:entity>
          <ids:name><ids:simpleValue>IFCWALL</ids:simpleValue></ids:name>
        </ids:entity>
      </ids:applicability>
      <ids:requirements>
        <ids:attribute>
          <ids:name><ids:simpleValue>Name</ids:simpleValue></ids:name>
        </ids:attribute>
      </ids:requirements>
    </ids:specification>
    <ids:specification name="墙体防火等级必填" ifcVersion="IFC4" description="墙体须标注防火等级 EI60">
      <ids:applicability minOccurs="1" maxOccurs="unbounded">
        <ids:entity>
          <ids:name><ids:simpleValue>IFCWALL</ids:simpleValue></ids:name>
        </ids:entity>
      </ids:applicability>
      <ids:requirements>
        <ids:property>
          <ids:propertySet><ids:simpleValue>Pset_WallCommon</ids:simpleValue></ids:propertySet>
          <ids:baseName><ids:simpleValue>FireRating</ids:simpleValue></ids:baseName>
          <ids:value><ids:simpleValue>EI60</ids:simpleValue></ids:value>
        </ids:property>
      </ids:requirements>
    </ids:specification>
    <ids:specification name="墙体隔声等级必填" ifcVersion="IFC4" description="墙体须标注隔声等级（示例：应缺失）">
      <ids:applicability minOccurs="1" maxOccurs="unbounded">
        <ids:entity>
          <ids:name><ids:simpleValue>IFCWALL</ids:simpleValue></ids:name>
        </ids:entity>
      </ids:applicability>
      <ids:requirements>
        <ids:property>
          <ids:propertySet><ids:simpleValue>Pset_WallCommon</ids:simpleValue></ids:propertySet>
          <ids:baseName><ids:simpleValue>AcousticRating</ids:simpleValue></ids:baseName>
        </ids:property>
      </ids:requirements>
    </ids:specification>
  </ids:specifications>
</ids:ids>
"""
