# 如何启动和调用 OpenClaw

**日期:** 2026-03-24  
**目的:** 说明如何正确启动 OpenClaw 并调用其 skills

---

## 🚀 启动 OpenClaw 的方式

### 方式 1: OpenClaw Gateway (推荐)

**启动 Gateway 服务:**
```bash
# 后台运行（推荐）
openclaw gateway start

# 或者前台运行（便于调试）
openclaw gateway --port 18789 --verbose
```

**检查状态:**
```bash
openclaw gateway status
```

**停止服务:**
```bash
openclaw gateway stop
```

**访问:**
- Gateway API: `http://localhost:18789`
- Web Dashboard: `http://localhost:18789/`

---

### 方式 2: OpenClaw Agent

**直接运行 Agent:**
```bash
# 单次执行
openclaw agent --message "生成 PPT" --thinking high

# 交互模式
openclaw agent
```

---

### 方式 3: OpenClaw CLI

**使用 CLI 命令:**
```bash
# 查看帮助
openclaw --help

# 运行 skill
openclaw skill run pptx --action create --title "TianLi"

# 发送消息
openclaw message send --to user --message "Hello"
```

---

## 🔌 调用 OpenClaw Skills

### 方式 1: 通过 Gateway API

**启动 Gateway 后:**
```python
import httpx
import asyncio

async def call_openclaw_skill(skill_name: str, params: dict):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:18789/api/skills/execute",
            json={
                "skill": skill_name,
                "params": params
            }
        )
        return response.json()

# 使用
result = await call_openclaw_skill("pptx", {
    "action": "create",
    "title": "TianLi Harness",
    "output": "presentation.pptx"
})

print(result)
```

---

### 方式 2: 通过 CLI

**直接调用:**
```bash
# 使用 openclaw 命令
openclaw skill run pptx \
  --action create \
  --title "TianLi Harness" \
  --output "presentation.pptx"

# 使用 npx skills
npx skills run pptx \
  --action create \
  --title "TianLi Harness"
```

**在 Python 中调用:**
```python
import subprocess

result = subprocess.run([
    "openclaw", "skill", "run", "pptx",
    "--action", "create",
    "--title", "TianLi Harness",
    "--output", "presentation.pptx"
], capture_output=True, text=True)

print(f"stdout: {result.stdout}")
print(f"stderr: {result.stderr}")
```

---

### 方式 3: 通过 OpenClaw Python SDK

**安装 SDK:**
```bash
pip install openclaw
```

**使用 SDK:**
```python
from openclaw import Client

client = Client(endpoint="http://localhost:18789")

# 调用 skill
result = await client.skills.execute(
    skill="pptx",
    params={
        "action": "create",
        "title": "TianLi Harness"
    }
)

# 发送消息
response = await client.send_message(
    "生成产品宣讲 PPT",
    skills=["pptx"]
)
```

---

## 🔧 OpenClawSkillExecutor 的实现

### 当前实现（修改后）

```python
async def execute_skill(self, skill_name: str, params: Dict[str, Any]):
    # Method 1: 使用 openclaw CLI
    cmd = ["openclaw", "skill", "run", skill_name]
    
    # 添加参数
    for key, value in params.items():
        cmd.extend([f"--{key}", str(value)])
    
    result = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    
    stdout, stderr = await result.communicate()
    
    if result.returncode == 0:
        return {"success": True, "stdout": stdout.decode()}
    
    # Method 2: Fallback 到 npx skills
    cmd = ["npx", "skills", "run", skill_name]
    # ...
```

### 调用流程

```
OpenClawSkillExecutor.execute_skill()
    ↓
尝试 1: openclaw CLI
    ├─ 成功 → 返回结果
    └─ 失败 → 尝试 2
        ↓
尝试 2: npx skills CLI
    ├─ 成功 → 返回结果
    └─ 失败 → 返回错误
```

---

## 📊 完整的 TianLi + OpenClaw 集成

### 架构图

```
用户请求
    ↓
TianLi HarnessEngine
    ↓
ppt-creator-hero (生成 PPT 内容)
    ↓
Doubao LLM (推理)
    ↓
天劫审计 (质量检查)
    ↓
OpenClawSkillExecutor (调用 skill)
    ↓
┌───────────────────────────────┐
│ 尝试 1: openclaw CLI          │
│ 尝试 2: npx skills CLI        │
│ 尝试 3: python-pptx (fallback)│
└───────────────────────────────┘
    ↓
生成 .pptx 文件
```

---

## ✅ 验证 OpenClaw 是否运行

### 检查 Gateway

```bash
# 检查状态
openclaw gateway status

# 检查进程
ps aux | grep openclaw

# 检查端口
lsof -i :18789
```

### 测试技能

```bash
# 列出已安装的 skills
openclaw skills list

# 测试 pptx skill
openclaw skill run pptx --help

# 或者
npx skills list | grep pptx
```

---

## 🎯 最佳实践

### 1. 开发环境

```bash
# 前台运行 Gateway，便于查看日志
openclaw gateway --port 18789 --verbose
```

### 2. 生产环境

```bash
# 后台运行 Gateway
openclaw gateway start

# 设置开机启动
# (根据系统添加到 systemd/launchd)
```

### 3. TianLi 集成

```python
from tianli_harness.core.openclaw_skill_executor import OpenClawSkillExecutor

executor = OpenClawSkillExecutor()

# 调用 skill
result = await executor.execute_skill(
    "pptx",
    {
        "action": "create",
        "title": "TianLi Harness",
        "output": "presentation.pptx"
    }
)

if result["success"]:
    print("✅ PPT 生成成功")
else:
    print(f"❌ 失败：{result.get('error')}")
```

---

## 📁 相关文件

| 文件 | 说明 |
|------|------|
| `core/openclaw_skill_executor.py` | OpenClaw Skill 执行器 |
| `tests/test_ppt_with_openclaw_skill.py` | 测试脚本 |
| `docs/HOW_TO_START_OPENCLAW.md` | 本文档 |

---

## 🎊 总结

**启动 OpenClaw:**
```bash
openclaw gateway start
```

**调用 Skills:**
```python
from tianli_harness.core.openclaw_skill_executor import OpenClawSkillExecutor

executor = OpenClawSkillExecutor()
result = await executor.execute_skill("pptx", {...})
```

**或者直接用 CLI:**
```bash
openclaw skill run pptx --action create --title "TianLi"
```

---

**GitHub:** https://github.com/seastaradmin/TianLi/blob/main/docs/HOW_TO_START_OPENCLAW.md
