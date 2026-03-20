#!/usr/bin/env python3
"""
TianLi Harness 后端服务器

提供：
1. SSE 实时日志推送
2. WebSocket 支持
3. REST API 查询状态
4. 静态文件服务（前端）
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Set, Optional
import httpx

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

# 尝试导入 fastapi 和 uvicorn
try:
    from fastapi import FastAPI, Request
    from fastapi.responses import StreamingResponse, HTMLResponse, FileResponse
    from fastapi.staticfiles import StaticFiles
    from fastapi.middleware.cors import CORSMiddleware
    import uvicorn
    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False
    logger.warning("FastAPI 未安装，使用基础 HTTP 服务器")

# 尝试导入 websockets
try:
    import websockets
    HAS_WEBSOCKETS = True
except ImportError:
    HAS_WEBSOCKETS = False

# 全局状态
class ServerState:
    def __init__(self):
        self.status = "idle"  # idle, running, completed, error
        self.total_steps = 0
        self.early_exits = 0
        self.l1_passes = 0
        self.l2_checks = 0
        self.logs = []
        self.sse_clients: Set = set()
        self.ws_clients: Set = set()
    
    def add_log(self, log: dict):
        self.logs.append(log)
        # 保持最近 1000 条
        if len(self.logs) > 1000:
            self.logs = self.logs[-1000:]
    
    def to_dict(self) -> dict:
        return {
            "status": self.status,
            "totalSteps": self.total_steps,
            "earlyExits": self.early_exits,
            "l1Passes": self.l1_passes,
            "l2Checks": self.l2_checks
        }

state = ServerState()

# ==================== FastAPI 实现 ====================

if HAS_FASTAPI:
    app = FastAPI(title="TianLi Harness API", version="1.0.0")
    
    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # 静态文件
    WEB_DIR = Path(__file__).parent / "web" / "dist"
    if WEB_DIR.exists():
        app.mount("/assets", StaticFiles(directory=str(WEB_DIR / "assets")), name="assets")
    
    @app.get("/")
    async def root():
        """提供前端页面"""
        # 优先提供新的 dashboard.html
        dashboard_html = Path(__file__).parent / "web" / "dashboard.html"
        if dashboard_html.exists():
            return FileResponse(str(dashboard_html))
        
        index_html = WEB_DIR / "index.html"
        if index_html.exists():
            return FileResponse(str(index_html))
        
        # 重定向到 dashboard
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url="/dashboard.html")
    
    @app.get("/api/logs")
    async def stream_logs(request: Request):
        """SSE 日志推送"""
        async def generate():
            client_id = id(request)
            state.sse_clients.add(client_id)
            logger.info(f"SSE 客户端连接：{client_id}")
            
            try:
                # 发送历史日志
                for log in state.logs[-50:]:
                    yield f"event: log\ndata: {json.dumps(log)}\n\n"
                
                # 发送当前状态
                yield f"event: stats\ndata: {json.dumps(state.to_dict())}\n\n"
                
                # 等待新日志
                last_count = len(state.logs)
                while True:
                    if await request.is_disconnected():
                        break
                    
                    if len(state.logs) > last_count:
                        for log in state.logs[last_count:]:
                            yield f"event: log\ndata: {json.dumps(log)}\n\n"
                        last_count = len(state.logs)
                    
                    await asyncio.sleep(0.5)
            finally:
                state.sse_clients.discard(client_id)
                logger.info(f"SSE 客户端断开：{client_id}")
        
        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
    
    @app.get("/api/status")
    async def get_status():
        """获取当前状态"""
        return state.to_dict()
    
    @app.get("/api/logs/history")
    async def get_logs_history(limit: int = 100):
        """获取历史日志"""
        return state.logs[-limit:]
    
    @app.post("/api/run/start")
    async def start_run(task: str = "写一篇 AI 觉醒的科幻小说"):
        """启动真实 Harness 任务"""
        return await harness_runner.start(task)
    
    @app.post("/api/run/stop")
    async def stop_run():
        """停止任务"""
        harness_runner.stop()
        return {"status": "stopped"}
    
    @app.get("/api/health")
    async def health_check():
        """健康检查"""
        return {"status": "ok", "clients": len(state.sse_clients)}

# ==================== 基础 HTTP 服务器（无 FastAPI 时） ====================

else:
    from http.server import HTTPServer, BaseHTTPRequestHandler
    import threading
    
    class TianLiHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path == "/api/status":
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(state.to_dict()).encode())
            
            elif self.path == "/api/logs":
                self.send_response(200)
                self.send_header("Content-Type", "text/event-stream")
                self.send_header("Cache-Control", "no-cache")
                self.send_header("Connection", "keep-alive")
                self.end_headers()
                
                try:
                    for log in state.logs[-50:]:
                        self.wfile.write(f"event: log\ndata: {json.dumps(log)}\n\n".encode())
                    self.wfile.flush()
                except:
                    pass
            
            else:
                self.send_response(200)
                self.send_header("Content-Type", "text/html")
                self.end_headers()
                html = f"""
                <html><head><title>TianLi Console</title></head>
                <body style="background:#1a1a2e;color:#eee;font-family:monospace;padding:20px">
                <h1>🌟 TianLi Console (基础模式)</h1>
                <p>状态：{state.status}</p>
                <p>步骤：{state.total_steps} | L1: {state.l1_passes} | L2: {state.l2_checks}</p>
                <div>{len(state.logs)} 条日志</div>
                </body></html>
                """
                self.wfile.write(html.encode())
        
        def log_message(self, format, *args):
            logger.info(f"HTTP {args[0]}")
    
    def run_basic_server(port: int):
        server = HTTPServer(("0.0.0.0", port), TianLiHandler)
        logger.info(f"基础 HTTP 服务器启动：http://0.0.0.0:{port}")
        server.serve_forever()

# ==================== 真实 TianLi Harness 集成 ====================

import subprocess
import threading

class TianLiHarnessRunner:
    """运行真实的 TianLi Harness 并捕获日志"""
    
    def __init__(self):
        self.process: Optional[subprocess.Popen] = None
        self.running = False
    
    async def start(self, task: str = "写一篇 AI 觉醒的科幻小说"):
        """启动 Harness"""
        if self.running:
            return {"error": "Already running"}
        
        self.running = True
        state.status = "running"
        
        # 添加启动日志
        state.add_log({
            "time": datetime.now().strftime("%H:%M:%S"),
            "level": "INFO",
            "module": "HARNESS",
            "msg": f"🚀 启动任务：{task[:50]}..."
        })
        
        # 启动线程运行 Harness
        threading.Thread(target=self._run_harness, args=(task,), daemon=True).start()
        
        return {"status": "started"}
    
    def _run_harness(self, task: str):
        """在后台线程运行 Harness"""
        try:
            # 运行 demo_novel_real.py
            script_path = Path(__file__).parent / "demo_novel_real.py"
            if not script_path.exists():
                logger.error(f"脚本不存在：{script_path}")
                return
            
            process = subprocess.Popen(
                ["python3", str(script_path)],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )
            
            # 读取输出
            for line in process.stdout:
                if not self.running:
                    process.terminate()
                    break
                
                line = line.strip()
                if not line:
                    continue
                
                # 解析日志
                log = self._parse_log_line(line)
                if log:
                    state.add_log(log)
                    
                    # 更新统计
                    if "EXECUTE" in log["module"]:
                        state.total_steps += 1
                    if "✅ 通过" in log["msg"]:
                        state.l1_passes += 1
                    if "TIANJIE-L2" in log["module"]:
                        state.l2_checks += 1
            
            state.status = "completed"
            state.add_log({
                "time": datetime.now().strftime("%H:%M:%S"),
                "level": "INFO",
                "module": "HARNESS",
                "msg": "✅ 任务完成"
            })
            
        except Exception as e:
            logger.error(f"Harness 运行错误：{e}")
            state.status = "error"
            state.add_log({
                "time": datetime.now().strftime("%H:%M:%S"),
                "level": "ERROR",
                "module": "HARNESS",
                "msg": f"❌ 错误：{str(e)}"
            })
        finally:
            self.running = False
    
    def _parse_log_line(self, line: str) -> Optional[dict]:
        """解析日志行"""
        # 格式：2026-03-20 10:12:04,495 [INFO] [STEP-1] 🧬 Fetch DNA
        import re
        
        # 尝试匹配标准格式
        match = re.match(
            r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),\d+ \[(\w+)\] \[([^\]]+)\] (.+)',
            line
        )
        
        if match:
            time_str, level, module, msg = match.groups()
            time_only = time_str.split(' ')[1]
            return {
                "time": time_only,
                "level": level,
                "module": module,
                "msg": msg
            }
        
        # 简单格式
        return {
            "time": datetime.now().strftime("%H:%M:%S"),
            "level": "INFO",
            "module": "OUTPUT",
            "msg": line
        }
    
    def stop(self):
        """停止运行"""
        self.running = False
        state.status = "idle"

harness_runner = TianLiHarnessRunner()

# ==================== 主函数 ====================

async def main():
    port = int(os.getenv("TIANLI_PORT", "8765"))
    
    logger.info("="*60)
    logger.info("🌟 TianLi Harness 后端服务器")
    logger.info("="*60)
    logger.info(f"端口：{port}")
    logger.info(f"FastAPI: {'✅' if HAS_FASTAPI else '❌ (使用基础模式)'}")
    logger.info(f"WebSocket: {'✅' if HAS_WEBSOCKETS else '❌'}")
    logger.info("="*60)
    
    if HAS_FASTAPI:
        config = uvicorn.Config(app, host="0.0.0.0", port=port, log_level="info")
        server = uvicorn.Server(config)
        await server.serve()
    else:
        run_basic_server(port)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("服务器已停止")
