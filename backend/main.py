"""
天理后端服务 - FastAPI 主应用

启动命令:
    python3 -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api_routes import router as api_router

app = FastAPI(
    title="天理 Harness API",
    description="天理项目后端服务 - 提供交付物、日志、指标等数据接口",
    version="0.1.0"
)

# CORS 配置（允许前端访问）
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000"
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(api_router)


@app.get("/")
async def root():
    """根路径"""
    return {
        "name": "天理 Harness API",
        "version": "0.1.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """健康检查"""
    from tianli_harness.core.db_connector import get_feedback_database
    
    try:
        db = get_feedback_database()
        # 测试数据库连接
        weights = db.get_hero_weights()
        return {
            "status": "healthy",
            "database": "connected",
            "weights_count": len(weights)
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e)
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
