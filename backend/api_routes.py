"""
天理后端 API 路由

提供前端所需的数据接口
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from pathlib import Path
import json

router = APIRouter(prefix="/api", tags=["frontend"])

# 数据库连接
from tianli_harness.core.db_connector import get_feedback_database

db = get_feedback_database()


# ==================== 数据模型 ====================

class Deliverable(BaseModel):
    id: str
    task_id: str
    file_name: str
    file_path: str
    file_size: int
    file_type: str
    created_at: str
    hero_id: str


class LogEntry(BaseModel):
    id: str
    timestamp: str
    level: str
    message: str
    task_id: Optional[str] = None
    hero_id: Optional[str] = None
    stage: Optional[str] = None


class Metrics(BaseModel):
    totalSessions: int
    totalRequests: int
    l1PassRate: float
    l2PassRate: float
    earlyExitRate: float
    avgLatencyMs: int
    totalViolations: int
    evolutionPatches: int


# ==================== 交付物接口 ====================

@router.get("/deliverables", response_model=List[Deliverable])
async def get_deliverables(
    filter: Optional[str] = Query('all', description="文件类型筛选：all|pptx|md|other")
):
    """获取所有交付物"""
    # TODO: 从数据库或文件系统读取
    # 目前返回 mock 数据
    
    mock_data = [
        {
            "id": "1",
            "task_id": "ppt-task-001",
            "file_name": "tianli_presentation.pptx",
            "file_path": "/generated_ppts/tianli_presentation.pptx",
            "file_size": 34212,
            "file_type": "pptx",
            "created_at": datetime.now().isoformat(),
            "hero_id": "ppt-creator-hero"
        }
    ]
    
    if filter != 'all':
        mock_data = [d for d in mock_data if d["file_type"] == filter]
    
    return mock_data


@router.get("/deliverables/{file_id}")
async def get_deliverable(file_id: str):
    """获取单个交付物详情"""
    # TODO: 实现
    return {"id": file_id, "status": "not_implemented"}


@router.get("/deliverables/{file_id}/download")
async def download_deliverable(file_id: str):
    """下载交付物"""
    # TODO: 实现文件下载
    file_path = Path("generated_ppts/tianli_presentation.pptx")
    if file_path.exists():
        return FileResponse(
            path=str(file_path),
            filename="tianli_presentation.pptx",
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation"
        )
    raise HTTPException(status_code=404, detail="文件不存在")


# ==================== 日志接口 ====================

@router.get("/logs", response_model=List[LogEntry])
async def get_logs(
    level: Optional[str] = Query('all', description="日志级别筛选"),
    task_id: Optional[str] = Query(None, description="任务 ID 筛选"),
    limit: int = Query(100, description="返回日志数量上限")
):
    """获取日志（支持实时推送）"""
    # TODO: 从数据库读取
    # 目前返回 mock 数据
    
    mock_logs = [
        {
            "id": "1",
            "timestamp": datetime.now().isoformat(),
            "level": "info",
            "message": "任务开始：生成产品宣讲 PPT",
            "task_id": "ppt-task-001",
            "hero_id": "ppt-creator-hero",
            "stage": "init"
        },
        {
            "id": "2",
            "timestamp": datetime.now().isoformat(),
            "level": "success",
            "message": "Hero 选择完成：ppt-creator-hero (分数：8.15)",
            "task_id": "ppt-task-001",
            "hero_id": "ppt-creator-hero",
            "stage": "dispatch"
        },
        {
            "id": "3",
            "timestamp": datetime.now().isoformat(),
            "level": "info",
            "message": "调用 LLM (Doubao-Seed-2.0-Code)",
            "task_id": "ppt-task-001",
            "stage": "llm"
        },
        {
            "id": "4",
            "timestamp": datetime.now().isoformat(),
            "level": "success",
            "message": "L1 审计通过 (无违规)",
            "task_id": "ppt-task-001",
            "stage": "audit_l1"
        },
        {
            "id": "5",
            "timestamp": datetime.now().isoformat(),
            "level": "success",
            "message": "L2 审计通过 (分数：0.92)",
            "task_id": "ppt-task-001",
            "stage": "audit_l2"
        },
        {
            "id": "6",
            "timestamp": datetime.now().isoformat(),
            "level": "info",
            "message": "生成 PPT 文件：tianli_presentation.pptx",
            "task_id": "ppt-task-001",
            "stage": "generation"
        },
        {
            "id": "7",
            "timestamp": datetime.now().isoformat(),
            "level": "success",
            "message": "任务完成 (耗时：1.18s)",
            "task_id": "ppt-task-001",
            "stage": "complete"
        }
    ]
    
    # 筛选
    if level != 'all':
        mock_logs = [log for log in mock_logs if log["level"] == level]
    if task_id:
        mock_logs = [log for log in mock_logs if log.get("task_id") == task_id]
    
    # 限制数量
    mock_logs = mock_logs[:limit]
    
    return mock_logs


@router.get("/logs/stream")
async def stream_logs(task_id: Optional[str] = None):
    """实时日志流 (SSE)"""
    # TODO: 实现 Server-Sent Events
    
    async def generate():
        # Mock 数据
        import asyncio
        while True:
            log = {
                "id": str(datetime.now().timestamp()),
                "timestamp": datetime.now().isoformat(),
                "level": "info",
                "message": f"实时日志 {datetime.now().strftime('%H:%M:%S')}",
                "task_id": task_id or "demo-task"
            }
            yield f"data: {json.dumps(log)}\n\n"
            await asyncio.sleep(5)
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    )


# ==================== 指标接口 ====================

@router.get("/metrics", response_model=Metrics)
async def get_metrics(
    range: str = Query('24h', description="时间范围：24h|7d|30d")
):
    """获取系统指标"""
    # TODO: 从数据库读取真实数据
    # 目前返回 mock 数据
    
    return {
        "totalSessions": 156,
        "totalRequests": 2847,
        "l1PassRate": 0.892,
        "l2PassRate": 0.967,
        "earlyExitRate": 0.043,
        "avgLatencyMs": 234,
        "totalViolations": 23,
        "evolutionPatches": 12
    }


@router.get("/metrics/hero-performance")
async def get_hero_performance():
    """获取 Hero 性能统计"""
    # TODO: 从数据库读取
    return {
        "heroes": [
            {"hero_id": "ppt-creator-hero", "total_tasks": 10, "success_rate": 0.9},
            {"hero_id": "ui-ux-hero", "total_tasks": 25, "success_rate": 0.88},
            {"hero_id": "engineering-hero", "total_tasks": 50, "success_rate": 0.92}
        ]
    }


# ==================== 数据库接口 ====================

@router.get("/database/status")
async def get_database_status():
    """获取数据库连接状态"""
    try:
        db = get_feedback_database()
        # 测试连接
        weights = db.get_hero_weights()
        return {
            "status": "connected",
            "database": "tianli_feedback",
            "tables_count": 7,
            "weights_count": len(weights)
        }
    except Exception as e:
        return {
            "status": "disconnected",
            "error": str(e)
        }


@router.get("/database/feedback-stats")
async def get_feedback_stats():
    """获取反馈统计"""
    # TODO: 从数据库读取
    return {
        "total_dispatch_decisions": 156,
        "total_task_results": 150,
        "total_user_feedbacks": 45,
        "avg_user_rating": 4.5
    }
