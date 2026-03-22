"""TianYan Optimizer - Generates evolution patches after early exit."""

from __future__ import annotations

from datetime import datetime
from typing import List

from tianli_harness.core.state import ActionTrace, HarnessConfig


class TianYanOptimizer:
    """TianYan (天演) optimizer for failed runs."""

    def __init__(self, anthropic, config: HarnessConfig):
        self.anthropic = anthropic
        self.config = config

    async def generate_patch(self, messages: List[dict], traces: List[ActionTrace]) -> str:
        """Generate a markdown patch proposal from failed traces."""
        original_prompt = ""
        for msg in messages:
            if msg.get("role") == "system":
                original_prompt = str(msg.get("content", ""))
                break

        failed_traces = [trace for trace in traces if not trace.is_valid] or traces[-3:]
        failed_text = self._format_failed_traces(failed_traces)

        if not self.anthropic:
            return self._heuristic_patch(original_prompt, failed_traces)

        prompt = f"""你是 TianLi Harness 天演优化器。

原始 System Prompt:
---
{original_prompt}
---

以下步骤触发了天劫熔断:
---
{failed_text}
---

请总结失败原因，给出一份对原始 System Prompt 的修改建议 Patch。
要求：
1. 先总结根因
2. 再给出 markdown 格式的 patch
3. patch 使用 git diff 风格
"""

        try:
            response = await self.anthropic.messages.create(
                model=self.config.audit_model,
                max_tokens=2048,
                messages=[{"role": "user", "content": prompt}],
            )
            text = "".join(block.text for block in response.content if getattr(block, "type", "") == "text").strip()
            if text:
                return text
        except Exception:
            pass

        return self._heuristic_patch(original_prompt, failed_traces)

    async def commit_patch(
        self,
        patch_content: str,
        hero_id: str,
        repo_owner: str,
        repo_name: str,
        github_token: str,
    ) -> str:
        """Commit the generated patch into a dedicated advisory file on a new branch."""
        from github import Github

        github = Github(github_token)
        repo = github.get_repo(f"{repo_owner}/{repo_name}")

        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        branch_name = f"tianli/evolution-{timestamp}"
        source = repo.get_branch("main")
        repo.create_git_ref(ref=f"refs/heads/{branch_name}", sha=source.commit.sha)

        file_path = f"tianli-evolution/{hero_id.replace('/', '__')}-{timestamp}.patch.md"
        repo.create_file(
            file_path,
            f"tianli: evolution patch for {hero_id}",
            patch_content,
            branch=branch_name,
        )
        return f"https://github.com/{repo_owner}/{repo_name}/compare/main...{branch_name}"

    def _format_failed_traces(self, traces: List[ActionTrace]) -> str:
        lines = []
        for trace in traces:
            lines.append(f"Step {trace.step}: hero={trace.hero_id or 'unknown'} tool={trace.tool_name}")
            lines.append(f"Parameters: {trace.parameters}")
            lines.append(f"Observation: {trace.observation[:200]}")
            if trace.audit_score is not None:
                lines.append(f"Audit score: {trace.audit_score:.2f}")
            if trace.audit_reason:
                lines.append(f"Audit reason: {trace.audit_reason}")
            lines.append("---")
        return "\n".join(lines)

    def _heuristic_patch(self, original_prompt: str, failed_traces: List[ActionTrace]) -> str:
        reasons = [trace.audit_reason or trace.observation for trace in failed_traces]
        concise_reason = reasons[0] if reasons else "The run drifted away from the requested task."
        return "\n".join(
            [
                "## TianYan Summary",
                concise_reason,
                "",
                "```diff",
                "--- current-prompt.md",
                "+++ improved-prompt.md",
                "@@",
                f"- {original_prompt[:120] or 'Current prompt is too generic.'}",
                "+ Stay tightly aligned with the active task. Before each tool call, confirm the action directly advances the current task and avoid repeated calls with near-identical parameters.",
                "+ If confidence is low, summarize uncertainty and request a narrower next action instead of guessing.",
                "```",
            ]
        )
