"""TianYan Optimizer - Generates evolution patches for System Prompts after early exit."""

from typing import List
from datetime import datetime
from tianli_harness.core.state import ActionTrace, HarnessConfig


class TianYanOptimizer:
    """TianYan (天演) optimizer - generates evolution patches for System Prompts
    after early exit, and optionally auto-commits to GitHub."""

    def __init__(self, anthropic, config: HarnessConfig):
        """
        Initialize TianYan Optimizer.
        
        Args:
            anthropic: AsyncAnthropic client
            config: Harness configuration
        """
        self.anthropic = anthropic
        self.config = config

    async def generate_patch(
        self,
        messages: List[dict],
        traces: List[ActionTrace]
    ) -> str:
        """
        Generate evolution patch after early exit.
        
        Args:
            messages: Conversation history including system prompt
            traces: Execution traces showing what failed
            
        Returns:
            Markdown-formatted patch with improvement suggestions
        """
        # Extract original system prompt
        original_prompt = ""
        for msg in messages:
            if msg.get("role") == "system":
                original_prompt = msg.get("content", "")
                break

        # Collect failed traces
        failed_traces = [t for t in traces if not t.is_valid]
        if not failed_traces:
            # If no explicit failed, take last few
            failed_traces = traces[-3:]

        failed_text = self._format_failed_traces(failed_traces)

        prompt = f"""你是 TianLi Harness 天演优化器。

原始 System Prompt 来自 GitHub:
---
{original_prompt}
---

执行历史中，以下步骤触发了天劫熔断:
---
{failed_text}
---

请总结失败原因，给出一份对原始 System Prompt 的修改建议 Patch。

Patch 应当：
1. 指出哪些地方需要修改
2. 给出修改后的具体内容
3. 解释为什么这样修改能防止未来再次触发同样的天劫

请用 markdown 格式输出，使用 git diff 风格展示改动。
"""

        response = await self.anthropic.messages.create(
            model="claude-opus-4-5-20250929",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}]
        )

        text = "".join(b.text for b in response.content if b.type == "text").strip()
        return text

    async def commit_patch(
        self,
        patch_content: str,
        hero_id: str,
        repo_owner: str,
        repo_name: str,
        github_token: str
    ) -> str:
        """
        Commit the evolution patch to GitHub as a new branch.
        
        Args:
            patch_content: The evolution patch content
            hero_id: Hero prompt filename
            repo_owner: GitHub repository owner
            repo_name: GitHub repository name
            github_token: GitHub API token
            
        Returns:
            GitHub compare URL for the new branch
        """
        from github import Github
        
        g = Github(github_token)
        repo = g.get_repo(f"{repo_owner}/{repo_name}")

        # Create new branch
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        branch_name = f"tianli/evolution-{timestamp}"
        source = repo.get_branch("main")
        repo.create_git_ref(
            ref=f"refs/heads/{branch_name}",
            sha=source.commit.sha
        )

        # Update the file - append the evolution patch
        file_path = f"{hero_id}.md"
        try:
            contents = repo.get_contents(file_path, ref="main")
            existing_content = contents.decoded_content.decode("utf-8")
            new_content = existing_content + "\n\n---\n\n## TianLi Evolution Patch\n\n" + patch_content
            repo.update_file(
                file_path,
                f"tianli: auto-evolution - fix early exit on {hero_id}",
                new_content,
                contents.sha,
                branch=branch_name
            )
        except Exception as e:
            # File doesn't exist - create it
            repo.create_file(
                file_path,
                f"tianli: auto-evolution - initial {hero_id} with evolution patch",
                patch_content,
                branch=branch_name
            )

        # Return the compare URL
        return f"https://github.com/{repo_owner}/{repo_name}/compare/main...{branch_name}"

    def _format_failed_traces(self, traces: List[ActionTrace]) -> str:
        """Format failed traces for prompt."""
        lines = []
        for i, trace in enumerate(traces):
            lines.append(f"Step {trace.step}: tool={trace.tool_name}")
            lines.append(f"Observation: {trace.observation[:200]}")
            if trace.audit_score is not None:
                lines.append(f"Audit score: {trace.audit_score:.2f}")
            lines.append("---")
        return "\n".join(lines)
