"""Concrete per-skill adapters for real local execution."""

from __future__ import annotations

import asyncio
import json
import re
import shutil
from dataclasses import replace
from pathlib import Path
from time import perf_counter
from typing import Awaitable, Callable, Dict, List, Optional, Sequence
from urllib.request import Request, urlopen

from tianli_harness.core.state import HarnessConfig, HeroProfile, SkillDispatch, TaskEnvelope


GUIDELINES_URL = "https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md"
COMMON_BROWSER_URLS = (
    "http://127.0.0.1:4174/",
    "http://127.0.0.1:4173/",
    "http://127.0.0.1:1420/",
    "http://127.0.0.1:3000/",
    "http://127.0.0.1:5173/",
)
URL_RE = re.compile(r"https?://[^\s)]+")


class SkillAdapter:
    """Base class for concrete skill execution adapters."""

    skill_ids: Sequence[str] = ()

    def __init__(self, config: HarnessConfig):
        self.config = config

    def matches(self, skill_id: str) -> bool:
        return skill_id in self.skill_ids

    async def execute(
        self,
        task: TaskEnvelope,
        hero: HeroProfile,
        role: str,
        dispatch: SkillDispatch,
    ) -> SkillDispatch:
        raise NotImplementedError


class RepoAwareSkillAdapter(SkillAdapter):
    """Base adapter that inspects the local repo for evidence."""

    def __init__(self, config: HarnessConfig, repo_root: Optional[Path] = None):
        super().__init__(config)
        self.repo_root = repo_root or Path(__file__).resolve().parents[2]

    def _load_ui_files(self) -> Dict[str, str]:
        candidates = [
            self.repo_root / "web/src/App.tsx",
            self.repo_root / "web/src/index.css",
            self.repo_root / "web/src/components/constellation/ConstellationView.tsx",
        ]
        loaded: Dict[str, str] = {}
        for path in candidates:
            if path.exists():
                loaded[str(path.relative_to(self.repo_root))] = path.read_text(encoding="utf-8")
        return loaded


class UIDesignReviewAdapter(RepoAwareSkillAdapter):
    """Analyze actual UI source for visual hierarchy and density issues."""

    skill_ids = ("ui-design-review",)

    async def execute(
        self,
        task: TaskEnvelope,
        hero: HeroProfile,
        role: str,
        dispatch: SkillDispatch,
    ) -> SkillDispatch:
        started = perf_counter()
        contribution = await asyncio.to_thread(self._analyze, task)
        return replace(
            dispatch,
            execution_status="completed",
            contribution=contribution,
            latency_ms=int((perf_counter() - started) * 1000),
        )

    def _analyze(self, task: TaskEnvelope) -> str:
        files = self._load_ui_files()
        app = files.get("web/src/App.tsx", "")
        css = files.get("web/src/index.css", "")
        constellation = files.get("web/src/components/constellation/ConstellationView.tsx", "")

        findings: List[str] = []
        if "galaxy-home-copy" in app or "galaxy-home-status" in app:
            findings.append("首页仍保留说明文案和状态行，首屏视觉焦点没有完全压到星系舞台。")
        if "page-switch" in app:
            findings.append("星系页直接暴露切页导航，宇宙入口仍像应用壳层而不是单一舞台。")
        if "celestial-hero-caption" in css or "destiny-seed-copy" in css:
            findings.append("Hero 星体和天命核默认常驻文字标签，远景感会被节点说明不断打断。")
        if "ReactFlow" in constellation:
            findings.append("当前星系舞台仍建立在流程图节点语义上，视觉上更接近编排图而不是沉浸式星图。")

        strengths: List[str] = []
        if "Space Grotesk" in css:
            strengths.append("字体方向已经比默认系统栈更有性格。")
        if "radial-gradient" in css:
            strengths.append("背景和星云层已经具备宇宙氛围基础。")

        inspected = ", ".join(files.keys()) or "未找到 UI 文件"
        lines = [f"检查了 {inspected}。"]
        if strengths:
            lines.append(f"优点：{' '.join(strengths[:2])}")
        if findings:
            lines.append(f"主要视觉问题：{' '.join(f'{index}. {item}' for index, item in enumerate(findings[:3], start=1))}")
        else:
            lines.append("这轮没有发现明显的视觉层级问题。")
        if "首页" in task.content or "星系" in task.content or "galaxy" in task.content.lower():
            lines.append("如果目标是纯星系首页，下一步应先拿掉首页说明文案、状态条和常驻切页按钮。")
        return " ".join(lines)


class WebDesignGuidelinesAdapter(RepoAwareSkillAdapter):
    """Run a concrete web-guidelines flavored audit against local UI code."""

    skill_ids = ("web-design-guidelines",)

    def __init__(
        self,
        config: HarnessConfig,
        repo_root: Optional[Path] = None,
        guideline_fetcher: Optional[Callable[[], str]] = None,
    ):
        super().__init__(config, repo_root=repo_root)
        self.guideline_fetcher = guideline_fetcher or self._fetch_guidelines

    async def execute(
        self,
        task: TaskEnvelope,
        hero: HeroProfile,
        role: str,
        dispatch: SkillDispatch,
    ) -> SkillDispatch:
        started = perf_counter()
        guidelines = await asyncio.to_thread(self.guideline_fetcher)
        contribution = await asyncio.to_thread(self._analyze, task, guidelines)
        return replace(
            dispatch,
            execution_status="completed",
            contribution=contribution,
            latency_ms=int((perf_counter() - started) * 1000),
        )

    def _fetch_guidelines(self) -> str:
        request = Request(GUIDELINES_URL, headers={"User-Agent": "TianLi-Harness/0.2"})
        try:
            with urlopen(request, timeout=30) as response:
                return response.read().decode("utf-8", errors="replace")
        except Exception:
            return ""

    def _analyze(self, task: TaskEnvelope, guidelines: str) -> str:
        files = self._load_ui_files()
        app = files.get("web/src/App.tsx", "")
        css = files.get("web/src/index.css", "")
        constellation = files.get("web/src/components/constellation/ConstellationView.tsx", "")

        findings: List[str] = []
        if "position: fixed;" in css and ".destiny-console" in css:
            findings.append("底部命令栏固定悬浮，长页和小屏下存在遮挡内容的风险。")
        if "panOnDrag={false}" in constellation and "zoomOnScroll={false}" in constellation:
            findings.append("星系舞台禁用了常见探索手势，复杂星图的可发现性会下降。")
        if "pageFromHash" in app and "changePage('observatory')" in app:
            findings.append("星系到观测台仍是硬切页，不是连续缩放或渐进展开。")

        positives: List[str] = []
        if 'aria-label="输入新的天命"' in app and 'aria-label="输入裁决意见"' in app:
            positives.append("天命和裁决输入已经带了显式 aria-label。")
        if 'className="sr-only"' in app:
            positives.append("关键输入保留了隐藏文本标签。")

        guideline_note = (
            f"已刷新 web-interface-guidelines（约 {len(guidelines.splitlines())} 行）。"
            if guidelines
            else "本轮未拿到远程 guidelines，已用本地规则集继续检查。"
        )
        inspected = ", ".join(files.keys()) or "未找到 UI 文件"
        lines = [guideline_note, f"检查了 {inspected}。"]
        if positives:
            lines.append(f"基础合规点：{' '.join(positives[:2])}")
        if findings:
            lines.append(f"主要体验风险：{' '.join(f'{index}. {item}' for index, item in enumerate(findings[:3], start=1))}")
        else:
            lines.append("这轮没有发现明显的结构性 guideline 风险。")
        if "首页" in task.content or "星系" in task.content or "galaxy" in task.content.lower():
            lines.append("若首页目标是纯星系，建议把裁决和统计入口彻底退为二级展开，而不是保留硬切导航。")
        return " ".join(lines)


class BrowserDevtoolsAdapter(SkillAdapter):
    """Probe a running page via browser-devtools-cli or lightweight HTTP fallback."""

    skill_ids = ("browser-devtools-cli",)

    def __init__(
        self,
        config: HarnessConfig,
        browser_cli_path: Optional[str] = None,
        command_runner: Optional[Callable[[List[str]], Awaitable[str]]] = None,
        http_fetcher: Optional[Callable[[str], str]] = None,
    ):
        super().__init__(config)
        self.browser_cli_path = browser_cli_path if browser_cli_path is not None else shutil.which("browser-devtools-cli")
        self.command_runner = command_runner or self._run_command
        self.http_fetcher = http_fetcher or self._fetch_url

    async def execute(
        self,
        task: TaskEnvelope,
        hero: HeroProfile,
        role: str,
        dispatch: SkillDispatch,
    ) -> SkillDispatch:
        started = perf_counter()
        target_url = await self._resolve_target_url(task)
        if not target_url:
            return replace(
                dispatch,
                execution_status="skipped",
                contribution="browser-devtools-cli 本轮没有找到可检查的页面 URL。",
                latency_ms=int((perf_counter() - started) * 1000),
            )

        try:
            if self.browser_cli_path:
                contribution = await self._inspect_with_cli(target_url, task, hero)
            else:
                contribution = await asyncio.to_thread(self._inspect_with_http, target_url)
            status = "completed"
        except Exception as exc:  # pragma: no cover - defensive fallback
            try:
                fallback = await asyncio.to_thread(self._inspect_with_http, target_url)
                contribution = f"browser-devtools-cli 执行失败，已退回 HTTP 探测：{exc} {fallback}"
                status = "completed"
            except Exception:
                contribution = f"browser-devtools-cli 执行失败：{exc}"
                status = "error"

        return replace(
            dispatch,
            execution_status=status,
            contribution=contribution,
            latency_ms=int((perf_counter() - started) * 1000),
        )

    async def _resolve_target_url(self, task: TaskEnvelope) -> Optional[str]:
        inline_urls = URL_RE.findall(task.content)
        candidates = inline_urls + list(COMMON_BROWSER_URLS)
        for url in candidates:
            try:
                await asyncio.to_thread(self.http_fetcher, url)
                return url
            except Exception:
                continue
        return None

    async def _inspect_with_cli(self, url: str, task: TaskEnvelope, hero: HeroProfile) -> str:
        session_id = f"tianli-{task.task_id}-{hero.hero_id.replace('/', '-')}"
        base = [self.browser_cli_path, "--json", "--quiet", "--session-id", session_id]
        await self.command_runner([*base, "navigation", "go-to", "--url", url])
        console_raw = await self.command_runner([*base, "o11y", "get-console-messages", "--type", "error"])
        vitals_raw = await self.command_runner([*base, "o11y", "get-web-vitals"])
        text_raw = await self.command_runner([*base, "content", "get-as-text"])

        console_messages = _parse_json_payload(console_raw) or []
        vitals = _parse_json_payload(vitals_raw) or {}
        text_preview = " ".join(str(text_raw).split())
        metrics = []
        for key in ("FCP", "LCP", "CLS", "INP", "TTFB"):
            if key in vitals:
                metrics.append(f"{key}={vitals[key]}")

        lines = [
            f"browser-devtools-cli 实查了 {url}。",
            f"控制台错误 {len(console_messages)} 条。",
        ]
        if metrics:
            lines.append(f"Web Vitals：{', '.join(metrics)}。")
        if text_preview:
            lines.append(f"页面文本预览：{text_preview[:120]}{'...' if len(text_preview) > 120 else ''}")
        return " ".join(lines)

    def _inspect_with_http(self, url: str) -> str:
        html = self.http_fetcher(url)
        title_match = re.search(r"<title>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
        title = title_match.group(1).strip() if title_match else "未命名页面"
        root_detected = "id=\"root\"" in html or "id='root'" in html
        return (
            f"已对 {url} 执行轻量页面探测。"
            f" 标题：{title}。"
            f" HTML 大小约 {len(html)} 字节。"
            f" {'检测到前端根容器。' if root_detected else '未检测到前端根容器。'}"
            " 当前环境未启用 browser-devtools-cli，已退回 HTTP 级检查。"
        )

    async def _run_command(self, cmd: List[str]) -> str:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=12)
        if process.returncode != 0:
            raise RuntimeError(stderr.decode("utf-8", errors="replace").strip() or "command failed")
        return stdout.decode("utf-8", errors="replace").strip()

    def _fetch_url(self, url: str) -> str:
        request = Request(url, headers={"User-Agent": "TianLi-Harness/0.2"})
        with urlopen(request, timeout=3) as response:
            return response.read().decode("utf-8", errors="replace")


class FallbackContributionAdapter(SkillAdapter):
    """Fallback adapter for skills without a bespoke executor."""

    async def execute(
        self,
        task: TaskEnvelope,
        hero: HeroProfile,
        role: str,
        dispatch: SkillDispatch,
    ) -> SkillDispatch:
        started = perf_counter()
        contribution = await asyncio.to_thread(self._build_contribution, task, hero, role, dispatch)
        return replace(
            dispatch,
            execution_status="completed",
            contribution=contribution,
            latency_ms=int((perf_counter() - started) * 1000),
        )

    def _build_contribution(
        self,
        task: TaskEnvelope,
        hero: HeroProfile,
        role: str,
        dispatch: SkillDispatch,
    ) -> str:
        task_text = f"{task.content} {' '.join(task.tags)}".lower()
        skill_id = dispatch.skill_id
        prefix = f"{skill_id} -> {hero.display_name} ({role})"

        suggestions = self._skill_suggestions(skill_id, task_text)
        if not suggestions:
            suggestions = self._generic_suggestions(dispatch)

        lines = [prefix]
        for index, suggestion in enumerate(suggestions[:3], start=1):
            lines.append(f"{index}. {suggestion}")
        return " ".join(lines)

    def _skill_suggestions(self, skill_id: str, task_text: str) -> List[str]:
        if skill_id == "tianli-harness":
            return [
                "保持天命分发、天劫、天演和最终裁决的链路可追踪，不要被 UI 遮蔽。",
                "当出现 early-exit 或打回时，优先保留轮次和星轨历史。",
                "交付摘要里需要明确主 Hero、协商团和裁决回流信息。",
            ]
        if skill_id == "find-skills":
            return [
                "核对本地已安装 skill 与 Hero 绑定是否一致，避免把不存在的 skill 派发出去。",
                "优先复用现有 skill，再决定是否新增外部 skill 引入。",
                "把 skill 的用途沉淀为可读的 brief，方便后续继续自动分发。",
            ]

        if {"ui", "design", "frontend", "页面"} & set(_tokenize(task_text)):
            return [
                "围绕界面层级、视觉焦点和动线给出可执行建议。",
                "优先指出最影响首屏感受的结构问题，而不是罗列所有细节。",
            ]
        if {"test", "review", "audit", "quality", "测试", "评审"} & set(_tokenize(task_text)):
            return [
                "补充最值得先验证的风险点和验收路径。",
                "把检查项写成短清单，便于 Hero 直接纳入交付。",
            ]
        return []

    def _generic_suggestions(self, dispatch: SkillDispatch) -> List[str]:
        summary = dispatch.summary or "提供针对当前天命的补充视角。"
        guidance = dispatch.guidance or "聚焦最关键的两到三个可执行建议。"
        return [summary, guidance]


def build_default_skill_adapters(config: HarnessConfig) -> List[SkillAdapter]:
    return [
        UIDesignReviewAdapter(config),
        WebDesignGuidelinesAdapter(config),
        BrowserDevtoolsAdapter(config),
    ]


def _tokenize(text: str) -> List[str]:
    return [token.lower() for token in re.findall(r"[\w\u4e00-\u9fff]+", text)]


def _parse_json_payload(raw: str) -> Optional[object]:
    try:
        return json.loads(raw)
    except Exception:
        return None
