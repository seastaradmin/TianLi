# TianLi Harness 质量与设计偏离评审

**日期:** 2026-03-21  
**评审方式:** 本地代码审查 + 子代理只读评审 + 运行验证

---

## 结论

当前版本已经从“原型可演示”推进到“具备真实分发与真实前后端链路的可运行版本”，但仍然更接近 **产品化中的 v1**，还不是严格意义上的生产完成态。

本轮改造后，项目的主要优点是：

- 已具备真实的 Hero registry、混合分发、结构化 SSE、星图控制台。
- Python 测试和 Web 测试已经能跑通。
- 后端 runner 可以直接产出 dispatch decision 和 run summary。

当前仍需警惕的风险是：

- Hero 执行层仍以启发式 tool planning 和模拟 executor 为主，不是完整 OpenClaw 生产接入。
- 远程 Hero/skill 导入仍是轻量协议，适合 v1，不适合复杂生态同步。
- LangGraph checkpoint 已支持持久化优先，但真实恢复策略尚未做完整操作手册与回归覆盖。

---

## 高优先级发现

1. **已修复：核心 graph 不再停在占位 `reason` 节点。** 旧版无法从用户输入进入真实 tool loop；现已具备 fetch -> reason -> audit -> exec/optimizer 闭环。
2. **已修复：early-exit 会进入 TianYan optimizer。** 旧版审计失败后直接结束；现已生成 `evolution_patch`，并把补丁提交策略改为独立 advisory 文件。
3. **已修复：状态模型从覆盖式改为 append-only 语义。** 旧版 `messages/traces` 易丢历史；现使用 LangGraph reducer 语义保存追加状态。
4. **已修复：后端控制面不再依赖 `demo_novel_real.py`。** 旧版是 demo shell；现由 backend runner 直接驱动分发、Hero run 和 SSE。
5. **已修复：前端不再默认走 mock-first。** 新版打开即加载 `/api/status`，并通过 SSE 接收 `sky_state / dispatch_decision / task_flow / run_summary`。

---

## 设计中有但之前未实现

- `optimizer` 节点接入主图
- append-only `messages/traces`
- 可恢复 checkpoint 优先策略
- 真实控制面而非 demo shell
- 结构化状态输出而非单纯日志输出

---

## 已实现但与原设计不同

- 原设计是单 Hero 治理流，当前实现升级为 **任务级多 Hero 分发**。
- 原设计中的 GitHub auto-commit 会直接改 hero prompt；新版改为写入 `tianli-evolution/*.patch.md`，避免污染运行 prompt。
- 原设计把前端定位成“流程图控制台”；新版是 **星图编排视图**，流程图不再是主视图。

---

## 新增但原设计未覆盖

- Hero registry 双来源模型（本地权威、远程刷新）
- 混合路由分发器
- Hero 星位、颜色、负载、任务光流表达
- `dispatch_decision / sky_state / task_flow / run_summary` 事件协议
- 远程 skill 刷新 API

---

## 当前质量评估

### 强项

- 架构方向更统一：后端、状态、前端语义都围绕同一个 dispatch/sky 模型。
- 测试基线已建立：Python `30 passed`，Web `17 passed`。
- 前端 build 通过，说明星图依赖和样式层已经可打包。

### 主要剩余风险

- Hero 执行还是“治理壳 + 模拟 executor”，适合演示与早期产品，不等于生产 OpenClaw 接入。
- 远程导入协议还比较轻，后续若接 skills.sh 正式元数据，需要单独定义兼容层。
- 真实多任务并发、历史存档、异常恢复还没有独立压测报告。

---

## 生产可用性结论

**结论：可作为 v1 内测版本继续推进，但不建议直接宣称生产完成。**

建议把下一阶段重点放在：

1. 接入真实 OpenClaw/LLM tool execution
2. 补充 run history 与恢复测试
3. 扩展远程 registry 协议与失败恢复
4. 对多任务并发和 SSE 重连做压力测试
