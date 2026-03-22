"""Task dispatch logic for routing work to heroes."""

from __future__ import annotations

import json
import math
import re
from collections import Counter
from typing import Dict, List, Optional, Sequence, Tuple
from uuid import uuid4

from tianli_harness.core.registry import HeroRegistry
from tianli_harness.core.state import (
    DispatchDecision,
    DispatchTarget,
    HarnessConfig,
    HeroProfile,
    TaskEnvelope,
)


TOOL_KEYWORDS: Dict[str, Sequence[str]] = {
    "Read": ("read", "查看", "inspect", "analyze", "读取"),
    "Write": ("write", "create", "generate", "写", "draft", "实现"),
    "Edit": ("edit", "modify", "update", "改", "调整"),
    "Grep": ("find", "search", "grep", "搜", "查找"),
    "Glob": ("files", "file", "目录", "glob", "list"),
    "Bash": ("run", "shell", "bash", "command", "命令"),
}

TOKEN_PATTERN = re.compile(r"[a-z0-9\u4e00-\u9fff]+")


class TaskDispatcher:
    """Routes normalized tasks to heroes using rules first and optional LLM ranking."""

    def __init__(self, config: HarnessConfig, registry: HeroRegistry, router_client=None):
        self.config = config
        self.registry = registry
        self.router_client = router_client

    async def dispatch(
        self,
        content: str,
        pinned_hero_ids: Optional[List[str]] = None,
        max_fanout: Optional[int] = None,
        dispatch_mode: Optional[str] = None,
        collaboration_mode: Optional[str] = None,
        verdict_round: int = 0,
        judgment_note: str = "",
    ) -> Tuple[TaskEnvelope, DispatchDecision, List[HeroProfile]]:
        task = self.normalize_task(
            content=content,
            pinned_hero_ids=pinned_hero_ids or [],
            max_fanout=max_fanout,
            dispatch_mode=dispatch_mode,
            collaboration_mode=collaboration_mode,
            verdict_round=verdict_round,
            judgment_note=judgment_note,
        )
        profiles = await self.registry.list_profiles(refresh_remote=False)
        candidates, fallback_used = self._rule_candidates(task, profiles)
        ranked = await self._rank_candidates(task, candidates)
        selected = ranked[: task.max_fanout]

        if task.collaboration_mode == "solo" and selected:
            selected = selected[:1]

        if not selected:
            defaults = [profile for profile in profiles if profile.hero_id in self.config.default_hero_ids]
            selected = defaults[: task.max_fanout] or profiles[: task.max_fanout]
            fallback_used = True

        candidate_scores = {profile.hero_id: round(score, 3) for profile, score in ranked}
        selected_targets = [
            DispatchTarget(
                hero_id=profile.hero_id,
                score=round(score, 3),
                reason=self._reason_for_selection(task, profile, score, fallback_used),
            )
            for profile, score in selected
        ]
        selected_hero_ids = [target.hero_id for target in selected_targets]
        selected_profiles = [
            next(profile for profile in profiles if profile.hero_id == hero_id)
            for hero_id in selected_hero_ids
        ]

        decision = DispatchDecision(
            task_id=task.task_id,
            strategy=task.dispatch_mode,
            selected_hero_ids=selected_hero_ids,
            primary_hero_id=selected_hero_ids[0] if selected_hero_ids else None,
            consult_hero_ids=selected_hero_ids[1:],
            coordination_mode=task.collaboration_mode,
            candidate_scores=candidate_scores,
            selected_targets=selected_targets,
            reasoning=self._build_reasoning(task, selected_targets, fallback_used),
            fallback_used=fallback_used,
            model_used=self.config.router_model if self.router_client and task.dispatch_mode in {"hybrid", "llm"} else None,
        )
        return task, decision, selected_profiles

    def normalize_task(
        self,
        content: str,
        pinned_hero_ids: List[str],
        max_fanout: Optional[int] = None,
        dispatch_mode: Optional[str] = None,
        collaboration_mode: Optional[str] = None,
        verdict_round: int = 0,
        judgment_note: str = "",
    ) -> TaskEnvelope:
        cleaned = " ".join(content.strip().split())
        normalized_mode = collaboration_mode or "primary_consult"
        normalized_fanout = max(1, min(max_fanout or self.config.max_fanout, 3))
        if normalized_mode == "solo":
            normalized_fanout = 1
        return TaskEnvelope(
            task_id=f"task-{uuid4().hex[:10]}",
            content=cleaned,
            pinned_hero_ids=list(pinned_hero_ids),
            max_fanout=normalized_fanout,
            dispatch_mode=dispatch_mode or self.config.dispatch_mode,
            collaboration_mode=normalized_mode,
            tags=self._extract_tags(cleaned),
            verdict_round=verdict_round,
            judgment_note=judgment_note.strip(),
        )

    def _extract_tags(self, content: str) -> List[str]:
        tokens = [token.lower() for token in re.findall(r"[\w\u4e00-\u9fff]+", content)]
        counts = Counter(token for token in tokens if len(token) > 1)
        return [token for token, _count in counts.most_common(8)]

    def _rule_candidates(
        self,
        task: TaskEnvelope,
        profiles: List[HeroProfile],
    ) -> Tuple[List[Tuple[HeroProfile, float]], bool]:
        enabled_profiles = [profile for profile in profiles if profile.enabled]
        pinned_matches = [profile for profile in enabled_profiles if profile.hero_id in task.pinned_hero_ids]
        fallback_used = False

        if task.pinned_hero_ids and pinned_matches:
            return [(profile, self._score(task, profile) + 5.0) for profile in pinned_matches], False

        scored = [
            (profile, self._score(task, profile))
            for profile in enabled_profiles
            if self._match_strength(task, profile) > 0
        ]

        if not scored:
            defaults = [profile for profile in enabled_profiles if profile.hero_id in self.config.default_hero_ids]
            if defaults:
                fallback_used = True
                scored = [(profile, profile.routing_priority + 0.5) for profile in defaults]
            else:
                fallback_used = True
                scored = [(profile, profile.routing_priority) for profile in enabled_profiles]

        scored.sort(key=lambda item: item[1], reverse=True)
        return scored, fallback_used

    async def _rank_candidates(
        self,
        task: TaskEnvelope,
        candidates: List[Tuple[HeroProfile, float]],
    ) -> List[Tuple[HeroProfile, float]]:
        if not candidates:
            return []

        if task.dispatch_mode not in {"hybrid", "llm"} or not self.router_client or len(candidates) < 2:
            return candidates

        hero_lines = [
            {
                "hero_id": profile.hero_id,
                "display_name": profile.display_name,
                "tags": profile.tags,
                "task_types": profile.task_types,
                "tools": profile.tools,
                "score": round(score, 3),
            }
            for profile, score in candidates
        ]
        prompt = (
            "You are routing a coding task to the best hero candidates.\n"
            "Return a JSON array of hero_id values sorted from best to worst.\n\n"
            f"Task: {task.content}\n"
            f"Tags: {task.tags}\n"
            f"Candidates: {json.dumps(hero_lines, ensure_ascii=False)}"
        )
        try:
            response = await self.router_client.messages.create(
                model=self.config.router_model,
                max_tokens=200,
                messages=[{"role": "user", "content": prompt}],
            )
            text = "".join(block.text for block in response.content if getattr(block, "type", "") == "text")
            ranked_ids = json.loads(text)
            if not isinstance(ranked_ids, list):
                return candidates
        except Exception:
            return candidates

        boost = {hero_id: max(0.05, 1.0 - index * 0.1) for index, hero_id in enumerate(ranked_ids)}
        ranked: List[Tuple[HeroProfile, float]] = []
        for profile, score in candidates:
            ranked.append((profile, round(score + boost.get(profile.hero_id, 0), 4)))
        ranked.sort(key=lambda item: item[1], reverse=True)
        return ranked

    def _score(self, task: TaskEnvelope, profile: HeroProfile) -> float:
        if not profile.enabled:
            return -math.inf

        score = profile.routing_priority + self._match_strength(task, profile)
        if profile.hero_id in self.config.default_hero_ids:
            score += 0.25
        return round(score, 4)

    def _match_strength(self, task: TaskEnvelope, profile: HeroProfile) -> float:
        strength = 0.0
        task_terms = set(task.tags)
        profile_terms = set(profile.tags + profile.task_types + profile.linked_skills)
        strength += len(task_terms & profile_terms) * 1.25

        lowered = task.content.lower()
        token_set = set(TOKEN_PATTERN.findall(lowered))
        for capability in profile.capabilities:
            if self._matches_keyword(capability.name, lowered, token_set):
                strength += capability.weight * 1.5

        for tool, keywords in TOOL_KEYWORDS.items():
            if tool not in profile.tools:
                continue
            if any(self._matches_keyword(keyword, lowered, token_set) for keyword in keywords):
                strength += 1.0

        return round(strength, 4)

    def _matches_keyword(self, keyword: str, lowered: str, token_set: set[str]) -> bool:
        normalized = keyword.lower().strip()
        if not normalized:
            return False
        if re.search(r"[\u4e00-\u9fff]", normalized):
            return normalized in lowered
        parts = TOKEN_PATTERN.findall(normalized)
        if not parts:
            return normalized in lowered
        if len(parts) == 1:
            return parts[0] in token_set
        return all(part in token_set for part in parts)

    def _reason_for_selection(
        self,
        task: TaskEnvelope,
        profile: HeroProfile,
        score: float,
        fallback_used: bool,
    ) -> str:
        if profile.hero_id in task.pinned_hero_ids:
            return "Pinned hero was explicitly requested by the task."
        if fallback_used and profile.hero_id in self.config.default_hero_ids:
            return "No strong match was found, so the dispatcher fell back to a default hero."
        matched_terms = sorted(set(task.tags) & set(profile.tags + profile.task_types))
        if matched_terms:
            return f"Matched tags {', '.join(matched_terms[:3])} with score {score:.2f}."
        return f"Selected by routing priority and tool compatibility with score {score:.2f}."

    def _build_reasoning(
        self,
        task: TaskEnvelope,
        targets: List[DispatchTarget],
        fallback_used: bool,
    ) -> str:
        parts = [
            f"Task '{task.content}' routed with mode '{task.dispatch_mode}'.",
            f"Coordination mode: '{task.collaboration_mode}'.",
        ]
        if task.pinned_hero_ids:
            parts.append(f"Pinned heroes: {', '.join(task.pinned_hero_ids)}.")
        if task.judgment_note:
            parts.append(f"Judgment note for reroute: {task.judgment_note}.")
        parts.extend(target.reason for target in targets)
        if fallback_used:
            parts.append("Fallback routing was used to guarantee at least one hero accepts the task.")
        return " ".join(parts)
