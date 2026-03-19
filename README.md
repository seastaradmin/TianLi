# TianLi Harness (天理 Harness)

> 天劫天演 Agent 治理沙箱 for OpenClaw

A layered constitutional Agent governance sandbox with early exit (天劫) and automatic evolution (天演) for OpenClaw, based on LangGraph.

## Architecture

TianLi Harness implements a **two-layer auditing system**:

```
┌─────────────────────────────────────────────────────────────┐
│                      User Input                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Fetch DNA (Hero Prompt from GitHub)                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Agent Reasoning (LLM generates tool call)                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. TianJie Interceptor (天劫 - Constitutional Audit)        │
│     ┌──────────────────────────────────────────────────┐    │
│     │ L1: Coarse Filtering (no LLM cost)                │    │
│     │   - Repetition detection                          │    │
│     │   - Forbidden words                               │    │
│     │   - Empty parameters                              │    │
│     └──────────────────────────────────────────────────┘    │
│     ┌──────────────────────────────────────────────────┐    │
│     │ L2: Deep Semantic Check (sampled, LLM call)       │    │
│     │   - Alignment scoring (0.0-1.0)                   │    │
│     │   - Drift detection                               │    │
│     └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                    ┌───────┴───────┐
                    │               │
            ┌───────▼───────┐ ┌─────▼────────┐
            │  PASS         │ │  FAIL        │
            │  Continue     │ │  Early Exit  │
            └───────┬───────┘ └─────┬────────┘
                    │               │
                    ▼               ▼
┌───────────────────────────┐ ┌────────────────────────────┐
│  4. Execute Tool (OpenClaw)│ │  5. TianYan Optimizer     │
│                           │ │     (天演 - Evolution)      │
│                           │ │     - Generate patch        │
│                           │ │     - Auto-commit to GitHub │
└───────────────────────────┘ └────────────────────────────┘
```

## Features

- **Layered Constitution**: Two-layer auditing (L1 fast rules + L2 sampled deep checks)
- **Early Exit (天劫)**: Stop execution before agent goes off-track
- **Automatic Evolution (天演)**: Generate improvement patches after failures
- **GitHub Integration**: Fetch Hero prompts and auto-commit evolution patches
- **LangGraph Orchestration**: Robust workflow with checkpointing
- **OpenClaw Integration**: Reuses existing session management and tool execution

## Installation

```bash
cd tianli_harness
pip install -r requirements.txt
```

### Dependencies

- Python 3.10+
- LangGraph
- Pydantic v2
- Anthropic SDK
- httpx
- PyGithub (for auto-commit)

## Usage

### Basic Example

```python
import asyncio
import anthropic
from tianli_harness import HarnessConfig, HarnessEngine

async def openclaw_executor(tool_name: str, params: dict):
    """Your OpenClaw tool executor."""
    # ... implementation ...
    return result

async def main():
    client = anthropic.AsyncAnthropic()
    config = HarnessConfig(
        hero_id="my-hero",  # GitHub: agency-agency/agency-agents/my-hero.md
        superpowers=["Read", "Glob", "Grep", "Bash", "Edit", "Write"],
        drift_threshold=0.4,
        l2_sample_ratio=0.3,
        repetition_threshold=3,
    )
    
    engine = HarnessEngine(config, client, openclaw_executor)
    
    result = await engine.run(
        thread_id="session-001",
        user_input="Help me implement a feature"
    )
    
    print(f"Status: {result['current_status']}")
    if result['current_status'] == 'early_exit':
        print("Agent was stopped by TianJie!")
        if result.get('evolution_patch'):
            print(f"Suggested improvement:\n{result['evolution_patch']}")

asyncio.run(main())
```

### Configuration Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `hero_id` | str | required | Hero prompt filename (without .md) |
| `superpowers` | List[str] | required | Allowed tools |
| `drift_threshold` | float | 0.4 | L2 alignment score threshold |
| `l2_sample_ratio` | float | 0.3 | Probability of L2 check (0.0-1.0) |
| `repetition_threshold` | int | 3 | Number of repeated calls to trigger L1 |
| `forbidden_words` | List[str] | [] | Words that trigger L1 failure |
| `repo_owner` | str | "agency-agency" | GitHub repo owner for DNA |
| `repo_name` | str | "agency-agents" | GitHub repo name for DNA |
| `github_token` | str | None | GitHub token for auto-commit |

### Advanced: Auto-Commit Evolution Patches

```python
config = HarnessConfig(
    hero_id="my-hero",
    superpowers=["Read", "Write"],
    github_token="ghp_...",  # Enable auto-commit
)
```

When early exit occurs, TianYan will automatically:
1. Generate an evolution patch
2. Create a new branch: `tianli/evolution-YYYYMMDD-HHMMSS`
3. Commit the patch
4. Return the compare URL

## Testing

```bash
# Run all tests
python -m pytest tests/ -v

# Run specific test file
python -m pytest tests/test_fetcher.py -v
python -m pytest tests/test_interceptor.py -v
python -m pytest tests/test_optimizer.py -v
```

## Project Structure

```
tianli_harness/
├── core/
│   ├── state.py          # State definitions
│   ├── graph.py          # LangGraph nodes & workflow
│   ├── interceptor.py    # TianJie layered audit
│   └── optimizer.py      # TianYan evolution
├── dna/
│   └── fetcher.py        # GitHub DNA fetcher
├── skills/
│   └── claw_proxy.py     # OpenClaw integration
├── tests/
│   ├── test_fetcher.py
│   ├── test_interceptor.py
│   └── test_optimizer.py
├── examples/
│   └── hello_world.py
├── __init__.py
└── README.md
```

## License

MIT
