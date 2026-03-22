# TianLi Harness 设计文档

**项目:** TianLi Harness - 天劫天演 Agent 治理沙箱  
**版本:** 2026-03-21 修订版  
**原始设计日期:** 2026-03-20  
**本次更新:** 星空 Hero 分发、双来源 Hero Registry、结构化 SSE 星图控制台

---

## 1. 设计目标

TianLi Harness 不再只是一条单 Hero、单链路的治理流程，而是升级为一个可观测的 Hero 星图调度系统：

- **Hero 星空**：每个 Hero 是一颗固定星体，具备能力标签、工具权限、优先级和星位坐标。
- **自动分发**：任务进入后，先由规则筛候选，再由 LLM 参与排序，最后由规则校验收敛到 1 个或多个 Hero。
- **任务光流**：任务与 Hero 之间的分发、执行、完成、熔断路径都通过发光流线表达。
- **治理闭环**：每个被分发到的 Hero 依然运行 TianJie/TianYan 流程，保留早期退出和进化补丁能力。
- **真实控制面**：前端不再依赖 mock 日志，而是消费后端结构化状态与事件。

---

## 2. 架构总览

### 2.1 分层结构

```text
User Task
  -> Hero Registry (local authoritative, remote refreshable)
  -> Task Dispatcher (rules -> optional LLM ranking -> rule convergence)
  -> Selected Hero Runs (1..N)
      -> Fetch DNA / local prompt
      -> Reason
      -> TianJie Audit
      -> Execute Tool
      -> TianYan Optimizer on early exit
  -> Live Event Bus
  -> Web Constellation Console
```

### 2.2 关键原则

1. **本地 Registry 是真相源**：远程来源只负责导入和刷新，不在任务热路径里做在线搜索。
2. **混合路由而非纯模型路由**：模型只参与候选排序，不直接拥有最终派单权。
3. **V1 任务级分发**：只在任务进入时分发，不做每个 tool call 的二次改派。
4. **可回退**：显式指定 Hero 时优先 obey；未命中时回退到默认 Hero 组，不能出现“无人接单”。
5. **控制台看真实状态**：前端只消费 `/api/status` 和 SSE，不再依赖演示模式。

---

## 3. 核心域模型

### 3.1 Hero Registry

`HeroProfile`
- `hero_id`
- `display_name`
- `description`
- `tags`
- `task_types`
- `tools`
- `linked_skills`
- `capabilities`
- `star_position`
- `routing_priority`
- `fallback_heroes`
- `max_parallel_tasks`
- `enabled`
- `system_prompt`
- `color`
- `source`

`RemoteHeroSource`
- `source_id`
- `kind`
- `url`
- `owner`
- `repo`
- `hero_ids`
- `enabled`

### 3.2 Dispatch

`TaskEnvelope`
- `task_id`
- `content`
- `pinned_hero_ids`
- `max_fanout`
- `dispatch_mode`
- `tags`
- `created_at`

`DispatchDecision`
- `task_id`
- `strategy`
- `selected_hero_ids`
- `primary_hero_id`
- `candidate_scores`
- `selected_targets`
- `reasoning`
- `fallback_used`
- `model_used`

### 3.3 Hero Run State

`ActionTrace`
- `step`
- `hero_id`
- `tool_name`
- `parameters`
- `observation`
- `is_valid`
- `audit_score`
- `audit_reason`
- `audit_stage`
- `timestamp`

`TianLiState`
- `config`
- `task`
- `messages` (append-only)
- `traces` (append-only)
- `task_flow` (append-only)
- `current_status`
- `evolution_patch`
- `pending_tool_call`
- `pending_audit`
- `dispatch_decision`

---

## 4. 自动分发设计

### 4.1 Hero 来源

V1 采用 **本地 + 远程** 双来源：

- **本地 registry**
  - 存放在仓库内 JSON 文件。
  - 持有 Hero 权威元数据、默认 prompt、星位和优先级。
- **远程来源**
  - 支持 `github_dna` 和 `generic_json/skills_json`。
  - 只在启动或手动刷新时导入到本地缓存。
  - 网络失败不阻塞任务启动。

### 4.2 混合路由

路由顺序固定为：

1. **任务归一化**
   - 提取 `TaskEnvelope`
   - 生成标签和关键词
2. **规则筛候选**
   - 只保留启用 Hero
   - 命中 pinned Hero 则直接优先
   - 依据 `tags/task_types/capabilities/tools` 计算匹配强度
3. **LLM 排名**
   - 仅在开启 `hybrid/llm` 且存在多个候选时启用
   - 输入是候选集合，不允许跳出候选池
4. **规则校验收敛**
   - 限制 `max_fanout`
   - 保证至少 1 个 Hero 被选中
   - 未命中时回退到 `default_hero_ids`

### 4.3 多 Hero 语义

V1 允许 1 到 3 个 Hero 组成固定小组：

- 每个 Hero 拥有独立 run
- 共用 parent task id
- 共享星图任务节点
- 各自拥有独立的 flow edge 和执行结果

---

## 5. TianJie / TianYan 闭环

### 5.1 TianJie

L1 粗筛：
- 重复调用检测
- 禁忌词检测
- 空参数检测

L2 深检：
- 使用模型评分或启发式评分
- 基于 `drift_threshold` 判断是否早退

### 5.2 TianYan

当 `current_status == "early_exit"`：

- 汇总失败 trace
- 生成一份 markdown patch 建议
- 可选提交到 GitHub 新分支
- **注意**：patch 单独写入 `tianli-evolution/*.patch.md`，而不是直接污染 hero prompt 文件

---

## 6. 后端接口与事件协议

### 6.1 REST API

`POST /api/run/start`
- body:
  - `task`
  - `pinnedHeroIds?`
  - `maxFanout?`
  - `dispatchMode?`

`POST /api/run/stop`
- 停止当前任务

`GET /api/status`
- 返回当前星图快照

`GET /api/heroes`
- 返回 Hero 运行态快照

`POST /api/skills/refresh`
- 刷新远程来源并写入本地缓存

### 6.2 SSE

事件名：
- `log`
- `stats`
- `sky_state`
- `dispatch_decision`
- `task_flow`
- `run_summary`

设计要求：
- `sky_state` 可独立驱动前端渲染
- 结构化事件用于细粒度动画和调试
- 日志继续保留，但不再充当前端唯一状态源

---

## 7. 星空前端设计

### 7.1 视图语义

- **Hero 节点**
  - 星体亮度映射负载
  - 颜色映射角色类型
  - 脉冲映射运行状态
- **任务节点**
  - 顶部漂浮的任务信号
  - 展示任务状态和 dispatch mode
- **光流边**
  - `routing`: 冷色流线
  - `running`: 更亮、更粗、更快
  - `completed`: 稳定收束
  - `failed/early_exit`: 红色失败光流

### 7.2 实现约束

- 保留 React + TypeScript + Vite
- 使用 React Flow 自定义节点和 animated edges
- 背景使用轻量 CSS 星空层
- V1 只做自动分发和观察，不做拖拽编排

---

## 8. 验证策略

### 8.1 Python

- Dispatcher：候选筛选、fallback、pinned hero、fanout
- Registry：本地/远程合并、缓存落盘、远程失败回退
- Core graph：能走完 fetch -> reason -> audit -> exec 或 optimizer

### 8.2 Web

- 星体渲染
- 任务节点渲染
- SSE 驱动下状态更新
- store 兼容行为
- 生产 build 必须通过

### 8.3 当前修订后的验收基线

- `python3 -m pytest -q`
- `npm run test:run`
- `npm run build`
- 直接调用 backend runner 能得到 dispatch decision 和 run summary

---

## 9. 本次修订解决的问题

相较 2026-03-20 初版，本次修订补齐了以下缺口：

- `reason` 节点不再是空占位
- early-exit 后真正进入 optimizer
- state 变为 append-only 语义，避免消息/trace 被覆盖
- 后端不再跑 demo shell，而是运行真实 dispatcher + hero runs
- 前端不再默认 mock 模式，而是消费真实 SSE 和状态快照
- 引入星空 Hero 视图、任务光流、双来源 Hero Registry

---

## 10. 后续迭代

下一阶段可以继续做：

1. 手动改派与任务重试
2. 更真实的 LLM routing 和 richer hero prompts
3. 持久化 run history
4. 更细粒度的 tool-level 光流
