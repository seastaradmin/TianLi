"""Local skill registry and dispatch helpers for TianLi."""

from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import List, Optional, Sequence

from tianli_harness.core.state import HarnessConfig, HeroProfile, SkillDispatch, TaskEnvelope
from tianli_harness.skills.adapters import FallbackContributionAdapter, build_default_skill_adapters


DEFAULT_SKILL_ROOTS = (
    Path.home() / ".agents" / "skills",
    Path.home() / ".codex" / "skills",
)


FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
DESCRIPTION_RE = re.compile(r"^description:\s*(.+)$", re.MULTILINE)
NAME_RE = re.compile(r"^name:\s*(.+)$", re.MULTILINE)


@dataclass(frozen=True)
class SkillProfile:
    """Resolved local skill metadata."""

    skill_id: str
    name: str
    description: str
    source_path: str
    guidance: str


class LocalSkillRegistry:
    """Resolve local SKILL.md files from configured skill roots."""

    def __init__(self, config: HarnessConfig):
        configured_roots = [Path(path).expanduser() for path in config.skill_search_paths if path]
        self.roots = configured_roots or list(DEFAULT_SKILL_ROOTS)

    async def resolve(self, skill_id: str) -> Optional[SkillProfile]:
        return await asyncio.to_thread(self._resolve_sync, skill_id)

    async def resolve_many(self, skill_ids: Sequence[str]) -> List[Optional[SkillProfile]]:
        return await asyncio.gather(*(self.resolve(skill_id) for skill_id in skill_ids))

    @lru_cache(maxsize=128)
    def _resolve_sync(self, skill_id: str) -> Optional[SkillProfile]:
        path = self._locate_skill_path(skill_id)
        if not path:
            return None

        text = path.read_text(encoding="utf-8")
        frontmatter = FRONTMATTER_RE.search(text)
        header = frontmatter.group(1) if frontmatter else ""
        name = _first_match(NAME_RE, header) or skill_id
        description = _first_match(DESCRIPTION_RE, header) or f"Local skill {skill_id}"
        guidance = self._extract_guidance(text)

        return SkillProfile(
            skill_id=skill_id,
            name=name.strip(),
            description=description.strip(),
            source_path=str(path),
            guidance=guidance,
        )

    def _locate_skill_path(self, skill_id: str) -> Optional[Path]:
        for root in self.roots:
            direct = root / skill_id / "SKILL.md"
            if direct.exists():
                return direct

        for root in self.roots:
            if not root.exists():
                continue
            matches = sorted(root.glob(f"**/{skill_id}/SKILL.md"))
            if matches:
                return matches[0]
        return None

    def _extract_guidance(self, text: str) -> str:
        cleaned_lines: List[str] = []
        for raw_line in text.splitlines():
            line = raw_line.strip()
            if not line or line == "---":
                continue
            if line.lower().startswith(("name:", "description:", "metadata:", "license:", "author:", "version:", "repository:")):
                continue
            if line.startswith("#"):
                continue
            cleaned_lines.append(line)
            if len(" ".join(cleaned_lines)) >= 600:
                break
        return " ".join(cleaned_lines)[:600]


class SkillDispatchPlanner:
    """Select and resolve relevant local skills for a hero/task pair."""

    def __init__(self, config: HarnessConfig, registry: Optional[LocalSkillRegistry] = None):
        self.config = config
        self.registry = registry or LocalSkillRegistry(config)

    async def dispatch_for_hero(self, task: TaskEnvelope, hero: HeroProfile) -> List[SkillDispatch]:
        selected = self._select_skills(task, hero)
        if not selected:
            return []

        resolved = await self.registry.resolve_many([skill_id for skill_id, _score, _reason in selected])
        dispatches: List[SkillDispatch] = []
        for (skill_id, score, reason), profile in zip(selected, resolved):
            if profile is None:
                dispatches.append(
                    SkillDispatch(
                        skill_id=skill_id,
                        status="missing",
                        match_score=round(score, 3),
                        reason=reason,
                    )
                )
                continue

            dispatches.append(
                SkillDispatch(
                    skill_id=skill_id,
                    status="applied",
                    summary=profile.description,
                    guidance=profile.guidance,
                    source_path=profile.source_path,
                    match_score=round(score, 3),
                    reason=reason,
                )
            )
        return dispatches

    def build_context(self, dispatches: Sequence[SkillDispatch]) -> str:
        applied = [dispatch for dispatch in dispatches if dispatch.status == "applied"]
        if not applied:
            return ""

        lines = ["Local skill briefings selected for this run:"]
        for dispatch in applied:
            summary = dispatch.summary or "No summary available."
            guidance = dispatch.guidance or ""
            contribution = dispatch.contribution or ""
            lines.append(f"- {dispatch.skill_id}: {summary}")
            if contribution:
                lines.append(f"  Contribution: {contribution}")
            if guidance:
                lines.append(f"  Guidance: {guidance}")
        return "\n".join(lines)

    def _select_skills(self, task: TaskEnvelope, hero: HeroProfile) -> List[tuple[str, float, str]]:
        if not hero.linked_skills:
            return []

        task_terms = set(_tokenize(task.content)) | set(_tokenize(" ".join(task.tags)))
        hero_terms = set(_tokenize(" ".join(hero.tags + hero.task_types)))
        ranked: List[tuple[str, float, str]] = []

        for index, skill_id in enumerate(hero.linked_skills):
            skill_terms = set(_tokenize(skill_id.replace("-", " ")))
            overlap = len(task_terms & skill_terms)
            hero_overlap = len(hero_terms & skill_terms)
            score = overlap * 1.4 + hero_overlap * 0.9 + max(0.0, 1.0 - index * 0.08)
            if task_terms & {"design", "ui", "ux", "frontend", "页面"} and skill_id in {"ui-design-review", "web-design-guidelines"}:
                score += 1.1
            if task_terms & {"test", "review", "quality", "verify", "audit", "测试", "评审"} and skill_id in {"web-design-guidelines", "ui-design-review"}:
                score += 0.8
            reason = (
                f"Matched {overlap} task terms and {hero_overlap} hero terms against skill '{skill_id}'."
            )
            ranked.append((skill_id, score, reason))

        ranked.sort(key=lambda item: item[1], reverse=True)
        fanout = max(0, min(self.config.max_skill_fanout, len(ranked)))
        return [item for item in ranked[:fanout] if item[1] > 0]


def _first_match(pattern: re.Pattern[str], text: str) -> str:
    match = pattern.search(text)
    return match.group(1) if match else ""


def _tokenize(text: str) -> List[str]:
    return [token.lower() for token in re.findall(r"[\w\u4e00-\u9fff]+", text)]


class LocalSkillExecutor:
    """Execute resolved skill assignments as concurrent local contribution workers."""

    def __init__(self, config: HarnessConfig, adapters: Optional[Sequence[object]] = None):
        self.config = config
        self.adapters = list(adapters) if adapters is not None else build_default_skill_adapters(config)
        self.fallback_adapter = FallbackContributionAdapter(config)

    async def execute_for_hero(
        self,
        task: TaskEnvelope,
        hero: HeroProfile,
        role: str,
        dispatches: Sequence[SkillDispatch],
    ) -> List[SkillDispatch]:
        applied = [dispatch for dispatch in dispatches if dispatch.status == "applied"]
        if not applied:
            return list(dispatches)

        executed = await asyncio.gather(
            *(self._execute_one(task, hero, role, dispatch) for dispatch in applied),
            return_exceptions=False,
        )
        executed_by_id = {dispatch.skill_id: dispatch for dispatch in executed}
        return [executed_by_id.get(dispatch.skill_id, dispatch) for dispatch in dispatches]

    async def _execute_one(
        self,
        task: TaskEnvelope,
        hero: HeroProfile,
        role: str,
        dispatch: SkillDispatch,
    ) -> SkillDispatch:
        adapter = next((item for item in self.adapters if item.matches(dispatch.skill_id)), self.fallback_adapter)
        return await adapter.execute(task, hero, role, dispatch)
