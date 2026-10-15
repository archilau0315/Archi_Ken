"""ArchiKen 计算内核（L2 核心计算层）服务。

已实现：IFC 解析服务（摘要 / 空间层级 / 构件列表 / 构件属性）、
几何内核服务（包围盒 / 三角网格 / 几何统计，含 .kengeo 缓存）、
碰撞引擎（硬碰撞 + 冲突矩阵：硬 / 间隙 / 净空分类与忽略规则）、
简化规则引擎（规则 DSL v1 + 求值器 + 内置模板 + 规则校验 + 合规预设）、
模型加载与融合（多文件融合 + 专业分类自动映射 + 融合模型树）、
IDS 校验（buildingSMART IDS 标准：结构解析 / 对模型校验 / 逐规范结果报告）、
合规性检查（M5：无障碍 / 净高 / 消防专用规则集，含净高与净尺寸检查）、
ITO / QTO 信息提取（M6：工程量推导 + 受控表达式自定义列 + Excel 导出）、
报告生成（M9：统一问题清单渲染为 PDF / Excel，原子写入导出目录）。
后续按计划接入：沟通与 BCF。
"""

import argparse
import logging
import os

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.routes.clash import router as clash_router
from app.routes.federation import router as federation_router
from app.routes.geometry import router as geometry_router
from app.routes.ids import router as ids_router
from app.routes.ifc import router as ifc_router
from app.routes.report import router as report_router
from app.routes.rules import router as rules_router
from app.routes.takeoff import router as takeoff_router

SERVICE_NAME = "archiken-kernel"
SERVICE_VERSION = "0.12.0"

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    """构建内核 FastAPI 应用。"""
    app = FastAPI(title=SERVICE_NAME, version=SERVICE_VERSION)

    @app.middleware("http")
    async def catch_exceptions(request: Request, call_next):
        """最底层兜底：任何未处理异常都记录完整栈并返回 JSON，避免裸 500。"""
        try:
            return await call_next(request)
        except Exception as exc:
            logger.error(
                "未处理异常 %s %s query=%s",
                request.method,
                request.url.path,
                str(request.url.query)[:500],
                exc_info=True,
            )
            return JSONResponse(
                status_code=500,
                content={"detail": f"内核内部错误：{type(exc).__name__}: {exc}"},
            )

    @app.get("/health")
    def health() -> dict:
        return {
            "status": "ok",
            "service": SERVICE_NAME,
            "version": SERVICE_VERSION,
            "build": os.environ.get("ARCHIKEN_BUILD_ID", "dev"),
        }

    app.include_router(ifc_router)
    app.include_router(geometry_router)
    app.include_router(clash_router)
    app.include_router(rules_router)
    app.include_router(federation_router)
    app.include_router(ids_router)
    app.include_router(takeoff_router)
    app.include_router(report_router)
    return app


app = create_app()


def main() -> None:
    parser = argparse.ArgumentParser(description="ArchiKen 计算内核服务")
    parser.add_argument("--host", default=os.environ.get("ARCHIKEN_KERNEL_HOST", "0.0.0.0"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("ARCHIKEN_KERNEL_PORT", "4319")))
    args = parser.parse_args()
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
