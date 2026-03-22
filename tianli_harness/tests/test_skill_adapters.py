"""Tests for concrete skill adapters."""

from pathlib import Path

import pytest

from tianli_harness.core.state import HarnessConfig, HeroProfile, SkillDispatch, TaskEnvelope
from tianli_harness.skills.adapters import BrowserDevtoolsAdapter, UIDesignReviewAdapter, WebDesignGuidelinesAdapter


def _write_ui_fixture(root: Path) -> None:
    app_path = root / "web/src/App.tsx"
    css_path = root / "web/src/index.css"
    constellation_path = root / "web/src/components/constellation/ConstellationView.tsx"

    app_path.parent.mkdir(parents=True, exist_ok=True)
    css_path.parent.mkdir(parents=True, exist_ok=True)
    constellation_path.parent.mkdir(parents=True, exist_ok=True)

    app_path.write_text(
        "\n".join(
            [
                "const pageFromHash = () => '#observatory'",
                "function changePage() {}",
                "export function App() {",
                "  return (",
                "    <main className=\"galaxy-home\">",
                "      <p className=\"galaxy-home-copy\">copy</p>",
                "      <div className=\"galaxy-home-status\" />",
                "      <nav className=\"page-switch\" />",
                "    </main>",
                "  )",
                "}",
            ]
        ),
        encoding="utf-8",
    )
    css_path.write_text(
        "\n".join(
            [
                ".celestial-hero-caption { color: white; }",
                ".destiny-seed-copy { color: white; }",
                ".destiny-console { position: fixed; }",
                ".app-shell { padding: 24px 24px 190px; }",
            ]
        ),
        encoding="utf-8",
    )
    constellation_path.write_text(
        "\n".join(
            [
                "export function ConstellationView() {",
                "  return <ReactFlow panOnDrag={false} zoomOnScroll={false} />",
                "}",
            ]
        ),
        encoding="utf-8",
    )


def _config() -> HarnessConfig:
    return HarnessConfig(hero_id="builder/forge", superpowers=["Read", "Write"])


def _hero() -> HeroProfile:
    return HeroProfile(hero_id="builder/forge", display_name="Forge")


def _dispatch(skill_id: str) -> SkillDispatch:
    return SkillDispatch(skill_id=skill_id, status="applied", summary=f"{skill_id} summary")


@pytest.mark.asyncio
async def test_ui_design_review_adapter_reads_real_ui_files(tmp_path: Path):
    _write_ui_fixture(tmp_path)
    adapter = UIDesignReviewAdapter(_config(), repo_root=tmp_path)
    result = await adapter.execute(
        TaskEnvelope(task_id="task-1", content="请继续打磨首页星系视觉。"),
        _hero(),
        "primary",
        _dispatch("ui-design-review"),
    )

    assert result.execution_status == "completed"
    assert "首屏视觉焦点" in result.contribution
    assert "page-switch" not in result.contribution
    assert "web/src/App.tsx" in result.contribution


@pytest.mark.asyncio
async def test_web_design_guidelines_adapter_fetches_rules_and_flags_risks(tmp_path: Path):
    _write_ui_fixture(tmp_path)
    adapter = WebDesignGuidelinesAdapter(
        _config(),
        repo_root=tmp_path,
        guideline_fetcher=lambda: "Rule A\nRule B\nRule C",
    )
    result = await adapter.execute(
        TaskEnvelope(task_id="task-2", content="审查这个星系首页的交互结构。"),
        _hero(),
        "consult",
        _dispatch("web-design-guidelines"),
    )

    assert result.execution_status == "completed"
    assert "已刷新 web-interface-guidelines" in result.contribution
    assert "底部命令栏固定悬浮" in result.contribution
    assert "星系舞台禁用了常见探索手势" in result.contribution


@pytest.mark.asyncio
async def test_browser_devtools_adapter_falls_back_to_http_probe():
    adapter = BrowserDevtoolsAdapter(
        _config(),
        browser_cli_path=None,
        http_fetcher=lambda _url: "<html><head><title>TianLi</title></head><body><div id=\"root\"></div></body></html>",
    )
    result = await adapter.execute(
        TaskEnvelope(task_id="task-3", content="检查一下 http://127.0.0.1:4174/ 的页面状态。"),
        _hero(),
        "primary",
        _dispatch("browser-devtools-cli"),
    )

    assert result.execution_status == "completed"
    assert "轻量页面探测" in result.contribution
    assert "TianLi" in result.contribution
    assert "前端根容器" in result.contribution
