"""TianJie Interceptor - Layered Constitution auditing."""

import random
import difflib
from typing import List, Optional
from pydantic import BaseModel, Field

from tianli_harness.core.state import HarnessConfig, ActionTrace


class AuditResult(BaseModel):
    """Result of TianJie audit check."""
    should_continue: bool = Field(description="True if check passed, False to trigger early exit")
    reason: str = Field(description="Reason for the decision")
    score: Optional[float] = Field(default=None, description="L2 alignment score if checked")


class TianJieInterceptor:
    """Layered Constitution interceptor - TianJie (天劫) auditing.

    Two-layer checking:
    - L1: Coarse filtering (repetition, forbidden words, format) - no LLM cost
    - L2: Sampled deep semantic alignment checking - LLM call to score alignment
    """

    def __init__(self, anthropic, config: HarnessConfig):
        """
        Initialize TianJie Interceptor.
        
        Args:
            anthropic: AsyncAnthropic client for L2 checks
            config: Harness configuration
        """
        self.anthropic = anthropic
        self.config = config

    def check_l1(
        self,
        tool_name: str,
        parameters: dict,
        traces: List[ActionTrace]
    ) -> AuditResult:
        """Run L1 coarse filtering - synchronous, no LLM call."""

        # Check 1: Repetition detection
        recent_tools = [t.tool_name for t in traces[-self.config.repetition_threshold:]]
        if len(recent_tools) >= self.config.repetition_threshold:
            # All recent are same tool - check parameters similarity
            if all(t == tool_name for t in recent_tools):
                # Check parameter similarity with last one
                if traces:
                    last_params = traces[-1].observation
                    current_str = str(parameters)
                    similarity = difflib.SequenceMatcher(
                        None, current_str, last_params
                    ).ratio()
                    if similarity > 0.9:
                        return AuditResult(
                            should_continue=False,
                            reason=f"L1: Repetition detected - {similarity:.2f} similar parameters for {tool_name}",
                            score=None
                        )

        # Check 2: Forbidden words in output/parameters
        if self.config.forbidden_words:
            content = str(parameters).lower()
            for word in self.config.forbidden_words:
                if word.lower() in content:
                    return AuditResult(
                        should_continue=False,
                        reason=f"L1: Forbidden word '{word}' detected",
                        score=None
                    )

        # Check 3: Empty parameters check
        if not parameters or all(v is None or v == "" for v in parameters.values()):
            return AuditResult(
                should_continue=False,
                reason="L1: Empty parameters detected",
                score=None
            )

        # All L1 checks passed
        return AuditResult(
            should_continue=True,
            reason="L1: All checks passed",
            score=None
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
        tool_parameters: dict
    ) -> AuditResult:
        """Run L2 deep semantic alignment check - LLM call required."""

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

        response = await self.anthropic.messages.create(
            model="claude-opus-4-5-20250929",
            max_tokens=10,
            messages=[{"role": "user", "content": prompt}]
        )

        # Parse score from response
        text = "".join(b.text for b in response.content if b.type == "text").strip()
        try:
            score = float(text)
        except ValueError:
            # Failed to parse - treat as pass to avoid false positives
            return AuditResult(
                should_continue=True,
                reason=f"L2: Failed to parse score '{text}', proceeding",
                score=None
            )

        # Clamp score to valid range
        score = max(0.0, min(1.0, score))

        if score < self.config.drift_threshold:
            return AuditResult(
                should_continue=False,
                reason=f"L2: Semantic drift detected - score {score:.2f} < threshold {self.config.drift_threshold:.2f}",
                score=score
            )

        return AuditResult(
            should_continue=True,
            reason=f"L2: Alignment check passed - score {score:.2f} >= threshold {self.config.drift_threshold:.2f}",
            score=score
        )

    def _format_history(self, history: List[dict]) -> str:
        """Format conversation history for prompt."""
        lines = []
        for i, msg in enumerate(history[-10:]):  # Only last 10 messages
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            if isinstance(content, str):
                lines.append(f"{role}: {content[:200]}...")
            else:
                lines.append(f"{role}: [content blocks]")
        return "\n".join(lines)

    def _format_dict(self, d: dict) -> str:
        """Format dict nicely."""
        return "\n".join(f"  {k}: {v}" for k, v in d.items())
