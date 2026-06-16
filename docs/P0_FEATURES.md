# P0 Core Governance Features

**Implementation Date:** 2026-03-24  
**Status:** ✅ Complete

## Overview

P0 features establish TianLi Harness's core differentiation as the **first constitutional AI agent governance framework** with layered auditing, early exit, and automatic evolution.

## Features Implemented

### 1. ✅ Predefined Professional Hero Templates

**File:** `tianli_harness/core/heroes.py`

**12 Professional Heroes:**

| Hero ID | Role | Specialization |
|---------|------|----------------|
| `engineering-hero` | Engineering Expert | Full-stack development, debugging, testing |
| `pm-hero` | Product Manager | Requirements, planning, architecture |
| `qa-hero` | QA Engineer | Security, performance, accessibility |
| `db-hero` | Database Architect | Schema design, query optimization |
| `infra-hero` | Infrastructure Engineer | Terraform, K8s, CI/CD |
| `frontend-hero` | Frontend Developer | React, Vue, TypeScript, CSS |
| `backend-hero` | Backend Developer | Python, Node.js, API design |
| `mobile-hero` | Mobile Developer | Flutter, React Native |
| `data-hero` | Data Engineer | ETL, analytics, ML integration |
| `security-hero` | Security Engineer | Security audit, pentesting |
| `devops-hero` | DevOps Engineer | CI/CD, automation, monitoring |
| `brainstorm-hero` | Creative Strategist | Ideation, creative problem solving |

**Usage:**

```python
from tianli_harness.core.heroes import get_predefined_hero, PREDEFINED_HEROES

# Get a specific hero
hero = get_predefined_hero("engineering-hero")
print(hero["system_prompt"])

# Get all heroes
all_heroes = get_all_predefined_heroes()

# Get heroes by category
engineering_heroes = get_heroes_by_category("engineering")

# Get heroes by tool
read_heroes = get_heroes_by_tool("Read")
```

**Benefits:**
- 🎯 Role-specific expertise
- 🚀 Faster setup (no need to write prompts)
- 📚 Best practices built-in
- 🔄 Easy to extend

---

### 2. ✅ YAML Configuration Support

**File:** `tianli_harness/core/config_loader.py`

**Features:**
- Declarative configuration (no code changes needed)
- Type-safe parsing with dataclasses
- Environment variable support
- Backward compatible with Python `HarnessConfig`

**Example Configuration:**

```yaml
hero:
  id: "engineering-hero"
  use_predefined: true
  superpowers:
    - Read
    - Write
    - Edit
    - Bash

tianjie:
  drift_threshold: 0.4
  repetition_threshold: 3
  l2_sample_ratio: 0.3
  forbidden_words:
    - "rm -rf"
    - "DROP TABLE"

tianyan:
  enabled: true
  auto_commit: false

dispatch:
  mode: "hybrid"
  max_fanout: 2
  router_model: "claude-3-5-haiku-latest"
```

**Usage:**

```python
from tianli_harness.core.config_loader import load_config, ConfigLoader

# Load from file
config = load_config("tianli-config.yaml")

# Or load from string
yaml_content = """
hero:
  id: "pm-hero"
  superpowers:
    - Read
    - Write
"""
config = load_config_from_string(yaml_content)

# Use with HarnessEngine
engine = HarnessEngine(config, anthropic, executor)
```

**Benefits:**
- 📝 No code changes for configuration updates
- 🔒 Version control friendly
- 🎨 Clean separation of config and code
- 🔄 Hot reload potential

---

### 3. ✅ Audit Rule Template Library

**File:** `tianli_harness/core/audit_rules.py`

**Rule Categories:**

#### Repetition Detection
- `repetition-tool-call` - Detect repeated tool calls with similar parameters
- `repetition-parameter` - Detect exact parameter repetition

#### Forbidden Patterns
- `forbidden-destructive` - Destructive commands (rm -rf, DROP TABLE, etc.)
- `forbidden-security` - Security risks (curl|bash, chmod 777, etc.)
- `forbidden-custom` - User-defined forbidden words

#### Empty Parameter Checks
- `empty-parameters` - Detect empty tool parameters
- `missing-required-param` - Detect missing required parameters

#### Security Audits
- `path-traversal` - Detect sensitive path access
- `sensitive-file-access` - Detect sensitive file access (.pem, .env, etc.)
- `command-injection` - Detect command injection patterns

#### Alignment Checks
- `task-drift` - Detect task alignment drift
- `context-loss` - Detect context loss

#### Performance
- `expensive-operation` - Detect expensive operations

**Usage:**

```python
from tianli_harness.core.audit_rules import AuditRuleEngine, AuditRuleTemplate

# Create rule engine with default rules
engine = AuditRuleEngine()

# Check a tool call
violations = engine.check(
    tool_name="Bash",
    parameters={"command": "rm -rf /tmp/test"},
    traces=[],
)

if violations:
    for v in violations:
        print(f"Violation: {v['name']} - {v['reason']}")
        print(f"Severity: {v['severity']}")

# Add custom rule
from tianli_harness.core.audit_rules import AuditRule

custom_rule = AuditRule(
    rule_id="no-production-db",
    name="Production Database Protection",
    description="Prevent access to production database",
    category="security",
    severity="critical",
    metadata={
        "forbidden_patterns": ["production", "prod-db"]
    },
)
engine.add_rule(custom_rule)
```

**Benefits:**
- 🛡️ Comprehensive security coverage
- 🔧 Extensible rule system
- 📊 Severity-based prioritization
- 🎯 Pre-built templates

---

### 4. ✅ Metrics Collection System

**File:** `tianli_harness/core/metrics.py`

**Tracked Metrics:**

| Category | Metrics |
|----------|---------|
| **Requests** | Total requests, successful completions, early exits |
| **L1 Audit** | Checks, pass/fail counts, pass rate |
| **L2 Audit** | Checks, pass/fail counts, pass rate, alignment scores |
| **Tools** | Call counts per tool, latency per tool |
| **Violations** | Violation details with timestamps |
| **Evolution** | Patches generated |

**Usage:**

```python
from tianli_harness.core.metrics import get_metrics_collector

# Get collector (auto-created)
collector = get_metrics_collector("./metrics")

# Start session
collector.start_session("session-001")

# Record events (automatic via HarnessEngine)
collector.record_l1_result(passed=True)
collector.record_l2_result(passed=False, score=0.35)
collector.record_tool_call("Read", latency_ms=150)
collector.record_early_exit("Security violation")

# End session
collector.end_session()

# Get summary
summary = collector.get_summary()
print(f"L1 Pass Rate: {summary['aggregate']['avg_l1_pass_rate']:.1%}")
print(f"L2 Pass Rate: {summary['aggregate']['avg_l2_pass_rate']:.1%}")

# Export report
report = collector.export_report("./metrics-report.md")
```

**Output Example:**

```json
{
  "session_id": "session-001",
  "duration_seconds": 45.2,
  "total_requests": 10,
  "l1": {
    "checks": 10,
    "passed": 8,
    "failed": 2,
    "pass_rate": 0.8
  },
  "l2": {
    "checks": 3,
    "passed": 3,
    "failed": 0,
    "pass_rate": 1.0,
    "avg_score": 0.85
  },
  "tool_calls": {
    "total": 15,
    "by_tool": {
      "Read": 8,
      "Write": 4,
      "Bash": 3
    },
    "avg_latency_ms": {
      "Read": 120,
      "Write": 250,
      "Bash": 450
    }
  },
  "early_exits": 2,
  "evolution_patches": 1
}
```

**Benefits:**
- 📈 Real-time visibility
- 🎯 Performance optimization insights
- 📊 Audit effectiveness tracking
- 🔍 Violation pattern analysis

---

## Integration Points

### HarnessEngine Updates

**File:** `tianli_harness/core/graph.py`

```python
from tianli_harness import HarnessEngine, HarnessConfig

# Load config from YAML
config = load_config("tianli-config.yaml")

# Create engine (metrics auto-initialized)
engine = HarnessEngine(
    config=config,
    anthropic=client,
    openclaw_executor=executor,
    session_id="my-session-001"  # Optional
)

# Run (metrics tracked automatically)
result = await engine.run("task-001", "Implement a feature")

# Access metrics
metrics = engine.metrics.get_current_session()
print(f"L1 Pass Rate: {metrics.l1_pass_rate:.1%}")
```

### Interceptor Integration

**File:** `tianli_harness/core/interceptor.py`

- L1 checks now use `AuditRuleEngine`
- L2 results automatically recorded in metrics
- Custom forbidden words from config supported

---

## Testing

### Run Unit Tests

```bash
cd ~/Desktop/TianLi
python -m pytest tianli_harness/tests/test_heroes.py -v
python -m pytest tianli_harness/tests/test_config_loader.py -v
python -m pytest tianli_harness/tests/test_audit_rules.py -v
python -m pytest tianli_harness/tests/test_metrics.py -v
```

### Integration Test

```python
import asyncio
from tianli_harness import HarnessEngine, load_config

async def test_p0_features():
    config = load_config("examples/tianli-config.yaml")
    
    # Mock executor
    async def mock_executor(tool_name, params):
        return {"status": "ok"}
    
    engine = HarnessEngine(config, None, mock_executor)
    result = await engine.run("test-001", "Read the README file")
    
    print(f"Status: {result['current_status']}")
    print(f"Metrics: {engine.metrics.get_summary()}")

asyncio.run(test_p0_features())
```

---

## Migration Guide

### From Python Config to YAML

**Before:**

```python
from tianli_harness import HarnessConfig

config = HarnessConfig(
    hero_id="engineering-hero",
    superpowers=["Read", "Write", "Bash"],
    drift_threshold=0.4,
    l2_sample_ratio=0.3,
)
```

**After:**

```yaml
# tianli-config.yaml
hero:
  id: "engineering-hero"
  superpowers:
    - Read
    - Write
    - Bash

tianjie:
  drift_threshold: 0.4
  l2_sample_ratio: 0.3
```

```python
from tianli_harness.core.config_loader import load_config

config = load_config("tianli-config.yaml")
```

---

## Next Steps (P1)

1. **Multi-platform executor abstraction** - Support Cursor, Claude Code, OpenCode
2. **Project memory system** - Cross-session context
3. **Enhanced parallel execution** - Git worktrees isolation
4. **Complete dashboard** - Real-time metrics visualization

---

## Summary

P0 features establish TianLi Harness as the **first constitutional AI agent governance framework** with:

- ✅ **12 Professional Heroes** - Role-specific expertise out of the box
- ✅ **YAML Configuration** - Declarative, version-control friendly
- ✅ **Audit Rule Library** - 15+ pre-built security and quality rules
- ✅ **Metrics System** - Comprehensive tracking and reporting

These features differentiate TianLi from competitors and provide a solid foundation for P1 enhancements.
