# TianLi Harness 后端服务器

提供实时日志推送和 Harness 控制 API。

## 功能

- ✅ SSE 实时日志推送
- ✅ 真实 TianLi Harness 集成
- ✅ REST API 状态查询
- ✅ 启动/停止控制
- ✅ 日志格式自动解析

## 快速启动

```bash
# 安装依赖
pip3 install fastapi uvicorn httpx

# 启动服务器
python3 backend_server.py

# 访问控制台
open http://localhost:8765
```

## API 接口

### GET /api/status
获取当前状态
```json
{
  "status": "running",
  "totalSteps": 3,
  "earlyExits": 0,
  "l1Passes": 3,
  "l2Checks": 1
}
```

### GET /api/logs
SSE 日志推送（EventStream）
```
event: log
data: {"time":"13:22:20","level":"INFO","module":"FETCH_DNA","msg":"🧬 Fetch DNA"}

event: stats
data: {"status":"running","totalSteps":1,...}
```

### GET /api/logs/history?limit=100
获取历史日志（最近 N 条）

### POST /api/run/start?task=xxx
启动 Harness 任务
```json
{"status": "started"}
```

### POST /api/run/stop
停止任务
```json
{"status": "stopped"}
```

### GET /api/health
健康检查
```json
{"status": "ok", "clients": 1}
```

## 架构

```
┌─────────────────┐     SSE      ┌─────────────────┐
│  浏览器控制台    │◄─────────────│  Python 后端     │
│  (静态页面)     │              │  (FastAPI)      │
└─────────────────┘              └────────┬────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │ demo_novel_real │
                                 │ (TianLi Harness)│
                                 └─────────────────┘
```

## 日志格式解析

自动解析以下格式：
```
2026-03-20 13:22:20,495 [INFO] [STEP-1] 🧬 Fetch DNA
```

解析为：
```json
{
  "time": "13:22:20",
  "level": "INFO",
  "module": "STEP-1",
  "msg": "🧬 Fetch DNA"
}
```

## 配置

环境变量：
- `TIANLI_PORT` - 服务器端口（默认 8765）

## 开发

### 添加新的 Harness 集成

修改 `TianLiHarnessRunner._run_harness()` 方法，调用你的 Harness 脚本。

### 自定义日志解析

修改 `TianLiHarnessRunner._parse_log_line()` 方法。

## 故障排查

### 日志不推送
1. 检查 SSE 连接：浏览器 Console 查看连接状态
2. 检查后端日志：查看是否有错误
3. 检查 Harness 脚本路径是否正确

### Harness 启动失败
1. 确保 `demo_novel_real.py` 存在
2. 检查 Python 依赖：`pip3 install -r requirements.txt`
3. 查看后端日志中的错误信息

## 下一步

- [ ] WebSocket 支持（双向通信）
- [ ] 认证/授权
- [ ] 多任务并发
- [ ] 日志持久化（数据库）
- [ ] 配置管理界面
