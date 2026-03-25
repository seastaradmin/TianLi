# HarnessEngine 配置需求说明

**日期:** 2026-03-24  
**目的:** 说明使用 HarnessEngine 实际执行任务需要的配置

---

## 📋 HarnessEngine 需要的参数

```python
from tianli_harness.core.graph import HarnessEngine

engine = HarnessEngine(
    config,        # 配置对象
    anthropic,     # LLM 客户端
    openclaw_executor,  # 执行器回调
    session_id     # 可选：会话 ID
)
```

---

## 1. config (HarnessConfig)

**必需字段:**
```python
from tianli_harness.core.state import HarnessConfig

config = HarnessConfig(
    hero_id="ppt-creator-hero",  # 使用的 Hero
    superpowers=["Read", "Write", "Bash"],  # 允许的工具
    drift_threshold=0.4,  # L2 审计阈值
    l2_sample_ratio=0.3,  # L2 采样率
    dispatch_mode="hybrid",  # 调度模式
)
```

**或者从 YAML 加载:**
```python
from tianli_harness.core.config_loader import load_config

config = load_config("config.yaml")
```

**状态:** ✅ 已实现，可以正常工作

---

## 2. anthropic (LLM 客户端)

**需要的接口:**
```python
class AnthropicClient:
    async def messages.create(
        self,
        model: str,
        max_tokens: int,
        messages: List[Dict]
    ) -> Response:
        pass
```

**支持的客户端:**

### A. Anthropic Claude (官方)
```python
import anthropic

client = anthropic.AsyncAnthropic(
    api_key="sk-ant-xxx"  # Anthropic API Key
)
```

**状态:** ❌ 需要 Anthropic API Key

### B. Volcengine Doubao (你的配置)
```python
import httpx

class DoubaoClient:
    def __init__(self, api_key, base_url):
        self.api_key = api_key
        self.base_url = base_url
        self.client = httpx.AsyncClient()
    
    async def messages.create(self, model, max_tokens, messages):
        response = await self.client.post(
            f"{self.base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": messages,
                "max_tokens": max_tokens,
            }
        )
        return response.json()

# 使用你的配置
client = DoubaoClient(
    api_key="660d27e6-e65f-4a33-8fea-87101d33c210",
    base_url="https://ark.cn-beijing.volces.com/api/coding/v3"
)
```

**状态:** ⚠️ 需要适配层 (DoubaoClient)

### C. OpenAI GPT
```python
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key="sk-xxx")
```

**状态:** ❌ 需要 OpenAI API Key

---

## 3. openclaw_executor (执行器回调)

**需要的接口:**
```python
async def executor(tool_name: str, params: Dict) -> Dict:
    """执行工具调用"""
    pass
```

**示例实现:**
```python
from tianli_harness.core.executors import LocalExecutor
import tempfile

temp_dir = tempfile.mkdtemp()
executor = LocalExecutor(temp_dir)

# 使用
result = await executor.execute("Write", {
    "file_path": "test.txt",
    "content": "Hello"
})
```

**状态:** ✅ 已实现，可以正常工作

---

## 4. session_id (可选)

```python
session_id="ppt-gen-001"
```

**状态:** ✅ 可选参数

---

## 🔧 实际使用示例

### 完整代码

```python
import asyncio
from tianli_harness.core.config_loader import load_config
from tianli_harness.core.executors import LocalExecutor
from tianli_harness.core.graph import HarnessEngine
import anthropic

async def generate_ppt():
    # 1. 加载配置
    config = load_config("config.yaml")
    config.hero_id = "ppt-creator-hero"
    
    # 2. 创建执行器
    import tempfile
    executor = LocalExecutor(tempfile.mkdtemp())
    
    # 3. 创建 LLM 客户端
    client = anthropic.AsyncAnthropic(api_key="sk-ant-xxx")
    
    # 4. 创建引擎
    engine = HarnessEngine(
        config=config,
        anthropic=client,
        openclaw_executor=executor.execute,
        session_id="ppt-001"
    )
    
    # 5. 执行任务
    result = await engine.run(
        "ppt-task-001",
        "生成产品宣讲 PPT"
    )
    
    return result

# 运行
asyncio.run(generate_ppt())
```

---

## ⚠️ 当前问题

### 问题 1: LLM 客户端不兼容

**现状:**
- 你有 Volcengine Doubao API Key
- HarnessEngine 默认需要 Anthropic 客户端
- Doubao API 格式和 Anthropic 不同

**解决方案:**
1. 创建 DoubaoClient 适配层
2. 或者获取 Anthropic API Key

### 问题 2: pptx skill 需要特定环境

**现状:**
- pptx skill 需要 python-pptx 库
- 需要安装：`pip install python-pptx`

**解决方案:**
```bash
pip install python-pptx
```

---

## 📊 配置状态总结

| 组件 | 状态 | 说明 |
|------|------|------|
| **config** | ✅ 正常 | 已实现，E2E 测试通过 |
| **anthropic** | ⚠️ 需适配 | 需要 DoubaoClient 适配层 |
| **executor** | ✅ 正常 | 已实现，E2E 测试通过 |
| **pptx skill** | ⚠️ 需安装 | 需要 `pip install python-pptx` |

---

## 🎯 下一步

**要让天理系统真正生成 PPT，需要:**

1. **创建 DoubaoClient 适配层** - 让 Doubao API 兼容 Anthropic 接口
2. **安装 python-pptx** - PPT 生成库
3. **实际执行一次** - 验证完整流程

**你想让我现在实现这些吗？**

---

**文档:** docs/HARNESS_ENGINE_REQUIREMENTS.md  
**GitHub:** https://github.com/seastaradmin/TianLi/blob/main/docs/HARNESS_ENGINE_REQUIREMENTS.md
