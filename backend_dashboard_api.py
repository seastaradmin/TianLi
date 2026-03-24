"""
Dashboard API endpoints for TianLi Harness
Add these to your existing FastAPI backend
"""

from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from pathlib import Path
import json
import io

router = APIRouter(prefix="/api", tags=["dashboard"])

# In-memory storage (replace with database in production)
metrics_store: Dict[str, Any] = {}
sessions_store: List[Dict[str, Any]] = []
health_data: Dict[str, Any] = {}


@router.get("/metrics")
async def get_metrics(range: str = Query("24h", regex="^(24h|7d|30d)$")):
    """
    Get aggregated metrics for the specified time range.
    """
    # Calculate time range
    now = datetime.now()
    if range == "24h":
        start_time = now - timedelta(hours=24)
    elif range == "7d":
        start_time = now - timedelta(days=7)
    else:  # 30d
        start_time = now - timedelta(days=30)
    
    # Aggregate metrics from sessions
    total_sessions = len([s for s in sessions_store if datetime.fromisoformat(s["start_time"]) >= start_time])
    total_requests = sum(s.get("total_requests", 0) for s in sessions_store if datetime.fromisoformat(s["start_time"]) >= start_time)
    
    # Calculate pass rates
    l1_rates = [s.get("l1_pass_rate", 0) for s in sessions_store if datetime.fromisoformat(s["start_time"]) >= start_time]
    l2_rates = [s.get("l2_pass_rate", 0) for s in sessions_store if datetime.fromisoformat(s["start_time"]) >= start_time]
    
    l1_pass_rate = sum(l1_rates) / len(l1_rates) if l1_rates else 0
    l2_pass_rate = sum(l2_rates) / len(l2_rates) if l2_rates else 0
    
    # Calculate early exit rate
    early_exits = sum(s.get("early_exits", 0) for s in sessions_store if datetime.fromisoformat(s["start_time"]) >= start_time)
    early_exit_rate = early_exits / total_requests if total_requests > 0 else 0
    
    # Calculate average latency
    latencies = [s.get("avg_latency_ms", 0) for s in sessions_store if datetime.fromisoformat(s["start_time"]) >= start_time]
    avg_latency = int(sum(latencies) / len(latencies)) if latencies else 0
    
    # Count violations and evolution patches
    total_violations = sum(len(s.get("violations", [])) for s in sessions_store if datetime.fromisoformat(s["start_time"]) >= start_time)
    evolution_patches = sum(s.get("evolution_patches", 0) for s in sessions_store if datetime.fromisoformat(s["start_time"]) >= start_time)
    
    return {
        "totalSessions": total_sessions,
        "totalRequests": total_requests,
        "l1PassRate": round(l1_pass_rate, 3),
        "l2PassRate": round(l2_pass_rate, 3),
        "earlyExitRate": round(early_exit_rate, 3),
        "avgLatencyMs": avg_latency,
        "totalViolations": total_violations,
        "evolutionPatches": evolution_patches,
        "timeRange": range,
    }


@router.get("/sessions")
async def get_sessions(limit: int = Query(10, ge=1, le=100)):
    """
    Get recent sessions with metrics.
    """
    # Sort by start time descending
    sorted_sessions = sorted(
        sessions_store,
        key=lambda s: s.get("start_time", ""),
        reverse=True
    )[:limit]
    
    return sorted_sessions


@router.get("/health")
async def get_health():
    """
    Get system health status.
    """
    # This should integrate with your actual health monitoring
    return {
        "executor": {
            "status": "healthy",
            "platforms": {
                "openclaw": True,
                "local": True,
                "cursor": False,
                "claude-code": False,
                "opencode": False,
            },
        },
        "resources": {
            "status": "healthy",
            "cpu_percent": 23,
            "memory_mb": 1228,
            "disk_percent": 45,
        },
        "audit": {
            "status": "healthy",
            "active_rules": 15,
            "l2_sample_rate": 0.3,
            "last_update": datetime.now().isoformat(),
        },
    }


@router.get("/charts/{metric}")
async def get_chart_data(
    metric: str,
    range: str = Query("24h", regex="^(24h|7d|30d)$"),
):
    """
    Get time-series data for charts.
    """
    # Calculate time points
    now = datetime.now()
    
    if range == "24h":
        intervals = 24
        delta = timedelta(hours=1)
    elif range == "7d":
        intervals = 7
        delta = timedelta(days=1)
    else:  # 30d
        intervals = 30
        delta = timedelta(days=1)
    
    data = []
    for i in range(intervals):
        timestamp = now - (delta * i)
        
        # Get metrics for this interval
        interval_start = timestamp - delta
        interval_sessions = [
            s for s in sessions_store
            if interval_start <= datetime.fromisoformat(s["start_time"]) < timestamp
        ]
        
        if metric == "requests":
            value = sum(s.get("total_requests", 0) for s in interval_sessions)
        elif metric == "pass-rates":
            l1_rates = [s.get("l1_pass_rate", 0) * 100 for s in interval_sessions]
            l2_rates = [s.get("l2_pass_rate", 0) * 100 for s in interval_sessions]
            data.append({
                "timestamp": timestamp.isoformat(),
                "label": f"{i}h ago" if range == "24h" else f"{i}d ago",
                "l1": round(sum(l1_rates) / len(l1_rates), 1) if l1_rates else 0,
                "l2": round(sum(l2_rates) / len(l2_rates), 1) if l2_rates else 0,
            })
            continue
        elif metric == "sessions":
            value = len(interval_sessions)
        else:
            value = 0
        
        data.append({
            "timestamp": timestamp.isoformat(),
            "label": f"{i}h ago" if range == "24h" else f"{i}d ago",
            "value": value,
        })
    
    # Reverse to get chronological order
    data.reverse()
    return data


@router.get("/reports/export")
async def export_report(range: str = Query("24h", regex="^(24h|7d|30d)$")):
    """
    Export metrics report as PDF/Markdown.
    """
    # Get metrics
    metrics = await get_metrics(range)
    sessions = await get_sessions(50)
    health = await get_health()
    
    # Generate Markdown report
    report = f"""# TianLi Harness Report
Generated: {datetime.now().isoformat()}
Time Range: {range}

## Summary

| Metric | Value |
|--------|-------|
| Total Sessions | {metrics['totalSessions']} |
| Total Requests | {metrics['totalRequests']} |
| L1 Pass Rate | {metrics['l1PassRate'] * 100:.1f}% |
| L2 Pass Rate | {metrics['l2PassRate'] * 100:.1f}% |
| Early Exit Rate | {metrics['earlyExitRate'] * 100:.1f}% |
| Avg Latency | {metrics['avgLatencyMs']}ms |
| Violations | {metrics['totalViolations']} |
| Evolution Patches | {metrics['evolutionPatches']} |

## System Health

- Executor: {health['executor']['status']}
- Resources: {health['resources']['status']}
- Audit Engine: {health['audit']['status']}

## Recent Sessions

| Session ID | Status | Duration | Requests | L1 Pass | L2 Pass |
|------------|--------|----------|----------|---------|---------|
"""
    
    for session in sessions[:10]:
        report += f"| {session['session_id']} | {session['status']} | {session['duration_seconds']:.1f}s | {session['total_requests']} | {session['l1_pass_rate'] * 100:.0f}% | {session['l2_pass_rate'] * 100:.0f}% |\n"
    
    # For PDF generation, you'd use a library like reportlab or weasyprint
    # For now, return as Markdown
    return StreamingResponse(
        io.BytesIO(report.encode()),
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename=tianli-report-{range}.md"},
    )


@router.post("/sessions")
async def create_session(session_data: Dict[str, Any]):
    """
    Record a new session (called by HarnessEngine after completion).
    """
    session_data["start_time"] = session_data.get("start_time", datetime.now().isoformat())
    sessions_store.append(session_data)
    return {"status": "ok", "session_id": session_data.get("session_id")}


@router.put("/health")
async def update_health(health_update: Dict[str, Any]):
    """
    Update health data (called by monitoring service).
    """
    health_data.update(health_update)
    return {"status": "ok"}


# Include this router in your main FastAPI app
# app.include_router(router)
