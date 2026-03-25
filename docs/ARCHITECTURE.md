# 天理项目架构图

**项目：** TianLi Harness  
**GitHub:** https://github.com/seastaradmin/TianLi  
**更新日期：** 2026-03-24

---

## 🏗️ 系统架构总览

```mermaid
graph TB
    subgraph "用户层"
        User[👤 用户]
        CLI[💻 CLI 工具]
        Web[🌐 Dashboard]
    end

    subgraph "天理 Harness 层"
        direction TB
        
        subgraph "Hero 调度中心"
            Dispatcher[🎯 TaskDispatcher]
            Heroes[🦸 14 个专业 Hero]
        end
        
        subgraph "天劫审计系统"
            L1[🛡️ L1 规则审计<br/>15+ 规则]
            L2[🧠 L2 语义审计<br/>LLM 调用]
            EarlyExit[⚠️ 早期退出]
        end
        
        subgraph "天演进化系统"
            Optimizer[🔧 优化器]
            Patch[📝 进化补丁]
            Commit[📤 GitHub 提交]
        end
        
        subgraph "执行层"
            Executor[⚙️ 多平台执行器]
            OpenClaw[OpenClaw]
            Cursor[Cursor]
            ClaudeCode[Claude Code]
            Local[本地执行]
        end
    end

    subgraph "支撑系统"
        Memory[🧠 项目记忆]
        Metrics[📊 指标收集]
        Parallel[∥ 并行执行]
    end

    subgraph "大模型层"
        Volcengine[🤖 Volcengine Ark<br/>Doubao-Seed-2.0-Code]
        Anthropic[Anthropic Claude]
        OpenAI[OpenAI GPT]
    end

    subgraph "交付物"
        Code[💻 生产级代码]
        Docs[📄 文档]
        Report[📊 审计报告]
    end

    User --> CLI
    User --> Web
    CLI --> Dispatcher
    Web --> Dispatcher
    
    Dispatcher --> Heroes
    Heroes --> L1
    L1 --> L2
    L2 --> EarlyExit
    EarlyExit --> Optimizer
    Optimizer --> Patch
    Patch --> Commit
    
    L2 --> Executor
    Executor --> OpenClaw
    Executor --> Cursor
    Executor --> ClaudeCode
    Executor --> Local
    
    Executor --> Volcengine
    Executor --> Anthropic
    Executor --> OpenAI
    
    Executor --> Code
    Optimizer --> Docs
    L1 --> Report
    
    Dispatcher -.-> Memory
    Executor -.-> Metrics
    Dispatcher -.-> Parallel
```

---

## 🦸 Hero 角色架构

```mermaid
graph LR
    subgraph "14 个专业 Hero"
        direction TB
        
        subgraph "工程类"
            Eng[🔧 Engineering<br/>全栈开发]
            FE[💻 Frontend<br/>React/Vue]
            BE[⚙️ Backend<br/>Python/Node]
            DB[🗄️ Database<br/>SQL/NoSQL]
        end
        
        subgraph "产品类"
            PM[📋 Product Manager<br/>需求/规划]
            UX[🎨 UI/UX<br/>设计专家]
        end
        
        subgraph "质量类"
            QA[✅ QA Engineer<br/>测试/审计]
            Sec[🔒 Security<br/>安全专家]
        end
        
        subgraph "运维类"
            DevOps[🚀 DevOps<br/>CI/CD]
            Infra[🏗️ Infra<br/>K8s/Terraform]
        end
        
        subgraph "其他"
            Mobile[📱 Mobile<br/>Flutter]
            Data[📊 Data<br/>ETL/ML]
            Brain[💡 Brainstorm<br/>创意策略]
            Trend[📈 Trend<br/>趋势研究]
        end
    end
    
    UserRequest[用户需求] --> PM
    PM --> Eng
    Eng --> FE
    Eng --> BE
    Eng --> DB
    FE --> UX
    BE --> QA
    DB --> QA
    QA --> DevOps
    DevOps --> Infra
    
    UX -.-> Mobile
    Data -.-> Eng
    Brain -.-> PM
    Trend -.-> All
```

---

## 🛡️ 天劫审计流程

```mermaid
sequenceDiagram
    participant User as 用户
    participant Hero as Hero
    participant L1 as L1 规则审计
    participant L2 as L2 语义审计
    participant Executor as 执行器
    participant Optimizer as 天演优化器
    
    User->>Hero: 任务："做个网站落地页"
    
    Hero->>L1: 工具调用请求
    
    rect rgb(200, 255, 200)
        Note over L1: L1 规则检查（无 LLM 成本）
        L1->>L1: 1. 重复检测
        L1->>L1: 2. 禁用词检查
        L1->>L1: 3. 参数验证
        L1->>L1: 4. 安全检查
    end
    
    alt L1 失败
        L1-->>Optimizer: 触发早期退出
        Optimizer->>Optimizer: 生成优化补丁
        Optimizer-->>User: 返回失败原因 + 优化建议
    else L1 通过
        L1->>L2: 采样进行 L2 检查
        
        rect rgb(200, 230, 255)
            Note over L2: L2 语义对齐（LLM 调用）
            L2->>L2: 计算对齐分数 (0.0-1.0)
            L2->>L2: 检测任务偏离
        end
        
        alt L2 分数 < 阈值
            L2-->>Optimizer: 触发早期退出
            Optimizer->>Optimizer: 生成进化补丁
            Optimizer-->>User: 返回语义偏离警告
        else L2 通过
            L2->>Executor: 执行工具调用
            Executor->>Executor: 调用大模型/API
            Executor-->>Hero: 返回结果
            Hero-->>User: 交付代码
        end
    end
```

---

## 📦 前后端架构

```mermaid
graph TB
    subgraph "前端层 (React)"
        Dashboard[📊 Dashboard]
        Components[🧩 组件库]
        Charts[📈 Recharts 图表]
        Design[🎨 Design System]
    end
    
    subgraph "后端层 (FastAPI)"
        API[🔌 REST API]
        Engine[⚙️ Harness Engine]
        Audit[🛡️ 审计服务]
        Memory[🧠 记忆服务]
    end
    
    subgraph "数据层"
        SQLite[(SQLite<br/>Checkpoints)]
        JSON[(JSON<br/>记忆存储)]
        Metrics[(JSON<br/>指标数据)]
    end
    
    subgraph "外部服务"
        Volcengine[🤖 Volcengine Ark]
        GitHub[📤 GitHub API]
        ClawHub[🦞 ClawHub Skills]
    end
    
    Dashboard --> API
    Components --> Dashboard
    Charts --> Dashboard
    Design --> Components
    
    API --> Engine
    Engine --> Audit
    Engine --> Memory
    
    Audit --> SQLite
    Memory --> JSON
    Engine --> Metrics
    
    Engine --> Volcengine
    Memory --> GitHub
    Engine --> ClawHub
```

---

## 🔄 完整执行流程

```mermaid
flowchart TD
    Start([开始]) --> Config[加载配置]
    Config --> Dispatch[任务调度]
    
    Dispatch --> HeroSelect{选择 Hero}
    HeroSelect -->|UI 任务 | UX[UI-UX Hero]
    HeroSelect -->|工程任务 | Eng[Engineering Hero]
    HeroSelect -->|产品任务 | PM[PM Hero]
    
    UX --> L1Check[L1 规则检查]
    Eng --> L1Check
    PM --> L1Check
    
    L1Check --> L1Pass{L1 通过？}
    L1Pass -->|否 | EarlyExit1[⚠️ 早期退出]
    L1Pass -->|是 | L2Check[L2 语义检查]
    
    L2Check --> L2Sample{采样？}
    L2Sample -->|否 | Execute[执行工具]
    L2Sample -->|是 | L2Pass{L2 通过？}
    
    L2Pass -->|否 | EarlyExit2[⚠️ 早期退出]
    L2Pass -->|是 | Execute
    
    EarlyExit1 --> Optimize[天演优化]
    EarlyExit2 --> Optimize
    
    Optimize --> Patch[生成补丁]
    Patch --> Save[保存结果]
    
    Execute --> CodeGen[生成代码]
    CodeGen --> QualityCheck[质量检查]
    
    QualityCheck --> Pass{通过？}
    Pass -->|否 | Optimize
    Pass -->|是 | Deliver[交付]
    
    Deliver --> End([结束])
    
    Save --> End
```

---

## 📊 数据流架构

```mermaid
graph LR
    subgraph "输入"
        UserInput[用户输入]
        Config[配置文件]
        Context[项目上下文]
    end
    
    subgraph "处理"
        Parse[解析任务]
        Route[路由到 Hero]
        Audit[审计检查]
        Generate[AI 生成]
        Verify[质量验证]
    end
    
    subgraph "输出"
        Code[生成的代码]
        Report[审计报告]
        Metrics[性能指标]
        Memory[记忆更新]
    end
    
    UserInput --> Parse
    Config --> Parse
    Context --> Parse
    
    Parse --> Route
    Route --> Audit
    Audit --> Generate
    Generate --> Verify
    
    Verify --> Code
    Verify --> Report
    Verify --> Metrics
    Verify --> Memory
```

---

## 🎯 核心模块依赖

```mermaid
graph TD
    subgraph "核心模块"
        Core[Core 模块]
        State[State 状态]
        Graph[Graph 工作流]
        Interceptor[Interceptor 审计]
        Optimizer[Optimizer 进化]
    end
    
    subgraph "功能模块"
        Heroes[Heroes 角色]
        Memory[Memory 记忆]
        Executors[Executors 执行器]
        Parallel[Parallel 并行]
        Trend[Trend 研究]
    end
    
    subgraph "依赖库"
        LangGraph[LangGraph]
        Pydantic[Pydantic]
        HTTPX[HTTPX]
        YAML[PyYAML]
    end
    
    Core --> State
    Core --> Graph
    Core --> Interceptor
    Core --> Optimizer
    
    Graph --> Heroes
    Graph --> Memory
    Graph --> Executors
    Graph --> Parallel
    
    Core --> LangGraph
    State --> Pydantic
    Executors --> HTTPX
    Heroes --> YAML
```

---

## 🏢 部署架构

```mermaid
graph TB
    subgraph "开发环境"
        DevPC[开发者电脑<br/>macOS/Windows/Linux]
        LocalIDE[本地 IDE<br/>Cursor/Claude Code]
        GitWorktree[Git Worktrees]
    end
    
    subgraph "运行环境"
        Gateway[Gateway 服务<br/>FastAPI]
        Dashboard[Dashboard<br/>React SPA]
        Workers[执行 Workers]
    end
    
    subgraph "云服务"
        Volcengine[火山引擎 Ark<br/>Doubao 模型]
        GitHub[GitHub<br/>代码托管]
        ClawHub[ClawHub<br/>技能市场]
    end
    
    DevPC --> LocalIDE
    LocalIDE --> Gateway
    Gateway --> Dashboard
    Gateway --> Workers
    Workers --> GitWorktree
    
    Gateway --> Volcengine
    Workers --> GitHub
    Gateway --> ClawHub
```

---

**文档生成：** TianLi Harness  
**生成时间：** 2026-03-24  
**版本：** v0.1.0
