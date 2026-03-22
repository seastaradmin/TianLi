"""TianJie Interceptor - Layered Constitution auditing."""

from __future__ import annotations

import difflib
import random
import re
from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from tianli_harness.core.state import ActionTrace, HarnessConfig


class AuditResult(BaseModel):
    """Result of TianJie audit check."""

    should_continue: bool = Field(description="True if check passed, False to trigger early exit")
    reason: str = Field(description="Reason for the decision")
    score: Optional[float] = Field(default=None, description="L2 alignment score if checked")
    stage: str = Field(default="L1", description="Audit stage")


class TianJieInterceptor:
    """Layered Constitution interceptor - TianJie (天劫) auditing."""

    def __init__(self, anthropic, config: HarnessConfig):
        self.anthropic = anthropic
        self.config = config

    def check_l1(
        self,
        tool_name: str,
        parameters: Dict[str, object],
        traces: List[ActionTrace],
    ) -> AuditResult:
        """Run L1 coarse filtering - synchronous, no LLM call."""

        recent_traces = traces[-self.config.repetition_threshold :]
        if len(recent_traces) >= self.config.repetition_threshold:
            recent_tools = [trace.tool_name for trace in recent_traces]
            if all(name == tool_name for name in recent_tools):
                current_str = str(parameters)
                previous_params = str(recent_traces[-1].parameters or recent_traces[-1].observation or {})
                similarity = difflib.SequenceMatcher(None, current_str, previous_params).ratio()
                if similarity > 0.9:
                    return AuditResult(
                        should_continue=False,
                        reason=f"L1: Repetition detected - {similarity:.2f} similar parameters for {tool_name}",
                        stage="L1",
                    )

        if self.config.forbidden_words:
            content = f"{tool_name} {parameters}".lower()
            for word in self.config.forbidden_words:
                if word.lower() in content:
                    return AuditResult(
                        should_continue=False,
                        reason=f"L1: Forbidden word '{word}' detected",
                        stage="L1",
                    )

        if not parameters or all(value is None or value == "" for value in parameters.values()):
            return AuditResult(
                should_continue=False,
                reason="L1: Empty parameters detected",
                stage="L1",
            )

        return AuditResult(
            should_continue=True,
            reason="L1: All checks passed",
            stage="L1",
        )

    def should_do_l2_check(self) -> bool:
        """Random sampling based on l2_sample_ratio."""
        if self.config.l2_sample_ratio >= 1.0:
            return True
        if self.config.l2_sample_ratio <= 0.0:
            return False
        return random.random() < self.config.l2_sample_ratio

    async def check_l2(
        self,
        original_prompt: str,
        conversation_history: List[dict],
        tool_name: str,
        tool_parameters: Dict[str, object],
    ) -> AuditResult:
        """Run L2 deep semantic alignment check - LLM call required when available."""

        if not self.anthropic:
            score = self._heuristic_alignment_score(original_prompt, conversation_history, tool_name, tool_parameters)
            return self._result_from_score(score)

        prompt = f"""你是 TianLi Harness 天劫监察者。

原始任务目标：
---
{original_prompt}
---

当前对话历史：
---
{self._format_history(conversation_history)}
---

模型即将调用工具：
工具名称：{tool_name}
参数：{self._format_dict(tool_parameters)}
---

请给当前即将执行的动作打分：
- 1.0 分：完全对齐目标，动作合理
- 0.0 分：完全偏离目标，动作毫无意义

只返回一个 0.0 到 1.0 之间的浮点数分数，不要解释。
"""

        try:
            response = await self.anthropic.messages.create(
                model=self.config.audit_model,
                max_tokens=10,
                messages=[{"role": "user", "content": prompt}],
            )
            text = "".join(block.text for block in response.content if getattr(block, "type", "") == "text").strip()
            score = float(text)
        except Exception:
            score = self._heuristic_alignment_score(original_prompt, conversation_history, tool_name, tool_parameters)

        return self._result_from_score(score)

    def _result_from_score(self, score: float) -> AuditResult:
        score = max(0.0, min(1.0, score))
        if score < self.config.drift_threshold:
            return AuditResult(
                should_continue=False,
                reason=f"L2: Semantic drift detected - score {score:.2f} < threshold {self.config.drift_threshold:.2f}",
                score=score,
                stage="L2",
            )
        return AuditResult(
            should_continue=True,
            reason=f"L2: Alignment check passed - score {score:.2f} >= threshold {self.config.drift_threshold:.2f}",
            score=score,
            stage="L2",
        )

    def _heuristic_alignment_score(
        self,
        original_prompt: str,
        conversation_history: List[dict],
        tool_name: str,
        tool_parameters: Dict[str, object],
    ) -> float:
        task_text = " ".join(
            str(message.get("content", ""))
            for message in conversation_history
            if message.get("role") == "user"
        )
        task_terms = set(self._tokenize(f"{original_prompt} {task_text}"))
        tool_terms = set(self._tokenize(f"{tool_name} {tool_parameters}"))
        if not tool_terms:
            return 0.0
        overlap = len(task_terms & tool_terms)
        tool_bonus = 0.15 if tool_name in {"Read", "Glob", "Grep"} else 0.05
        return min(1.0, 0.2 + overlap * 0.15 + tool_bonus)

    def _format_history(self, history: List[dict]) -> str:
        lines = []
        for msg in history[-10:]:
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            if isinstance(content, str):
                lines.append(f"{role}: {content[:200]}")
            else:
                lines.append(f"{role}: [content blocks]")
        return "\n".join(lines)

    def _format_dict(self, data: Dict[str, object]) -> str:
        return "\n".join(f"  {key}: {value}" for key, value in data.items())

    def _tokenize(self, text: str) -> List[str]:
        return [token.lower() for token in re.findall(r"[\w\u4e00-\u9fff]+", text)]
