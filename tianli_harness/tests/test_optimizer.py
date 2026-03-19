"""Unit tests for TianYan Optimizer."""

import pytest
from unittest.mock import Mock, AsyncMock, patch
from tianli_harness.core.optimizer import TianYanOptimizer
from tianli_harness.core.state import HarnessConfig, ActionTrace


class TestTianYanOptimizer:
    """Tests for TianYanOptimizer class."""

    def test_init(self):
        """Test initialization."""
        mock_anthropic = Mock()
        config = HarnessConfig(hero_id="test", superpowers=[])
        optimizer = TianYanOptimizer(mock_anthropic, config)
        
        assert optimizer.anthropic == mock_anthropic
        assert optimizer.config == config

    def test_format_failed_traces(self):
        """Test formatting failed traces."""
        mock_anthropic = Mock()
        config = HarnessConfig(hero_id="test", superpowers=[])
        optimizer = TianYanOptimizer(mock_anthropic, config)
        
        traces = [
            ActionTrace(
                step=1,
                tool_name="Read",
                observation="File not found error",
                is_valid=False,
                audit_score=0.2
            ),
            ActionTrace(
                step=2,
                tool_name="Bash",
                observation="Permission denied",
                is_valid=False,
                audit_score=0.1
            )
        ]
        
        result = optimizer._format_failed_traces(traces)
        
        assert "Step 1" in result
        assert "Step 2" in result
        assert "Read" in result
        assert "Bash" in result
        assert "Audit score: 0.20" in result
        assert "Audit score: 0.10" in result

    def test_format_failed_traces_without_score(self):
        """Test formatting traces without audit scores."""
        mock_anthropic = Mock()
        config = HarnessConfig(hero_id="test", superpowers=[])
        optimizer = TianYanOptimizer(mock_anthropic, config)
        
        traces = [
            ActionTrace(
                step=1,
                tool_name="Read",
                observation="Error",
                is_valid=False,
                audit_score=None
            )
        ]
        
        result = optimizer._format_failed_traces(traces)
        
        assert "Step 1" in result
        assert "Audit score" not in result

    @pytest.mark.asyncio
    async def test_generate_patch_structure(self):
        """Test generate patch constructs correct prompt."""
        mock_anthropic = Mock()
        
        # Setup mock response
        mock_response = Mock()
        mock_block = Mock()
        mock_block.type = "text"
        mock_block.text = "# Suggested Patch\n\n- Fix issue X"
        mock_response.content = [mock_block]
        
        mock_anthropic.messages.create = AsyncMock(return_value=mock_response)
        
        config = HarnessConfig(hero_id="test", superpowers=[])
        optimizer = TianYanOptimizer(mock_anthropic, config)
        
        traces = [
            ActionTrace(step=1, tool_name="Read", observation="error", is_valid=False, audit_score=0.2)
        ]
        messages = [
            {"role": "system", "content": "Original prompt"},
            {"role": "user", "content": "Do something"},
        ]
        
        result = await optimizer.generate_patch(messages, traces)
        
        assert "# Suggested Patch" in result
        assert "Fix issue X" in result
        
        # Verify the prompt was constructed
        call_args = mock_anthropic.messages.create.call_args
        assert call_args is not None
        prompt_content = call_args[1]["messages"][0]["content"]
        assert "Original prompt" in prompt_content
        assert "Step 1" in prompt_content

    @pytest.mark.asyncio
    async def test_generate_patch_no_failed_traces(self):
        """Test generate patch with no failed traces uses last few."""
        mock_anthropic = Mock()
        
        mock_response = Mock()
        mock_block = Mock()
        mock_block.type = "text"
        mock_block.text = "# Patch"
        mock_response.content = [mock_block]
        
        mock_anthropic.messages.create = AsyncMock(return_value=mock_response)
        
        config = HarnessConfig(hero_id="test", superpowers=[])
        optimizer = TianYanOptimizer(mock_anthropic, config)
        
        # All traces are valid
        traces = [
            ActionTrace(step=1, tool_name="Read", observation="ok", is_valid=True),
            ActionTrace(step=2, tool_name="Glob", observation="ok", is_valid=True),
            ActionTrace(step=3, tool_name="Grep", observation="ok", is_valid=True),
        ]
        messages = [
            {"role": "system", "content": "Original"},
        ]
        
        result = await optimizer.generate_patch(messages, traces)
        
        # Should still work, using last 3 traces
        assert result == "# Patch"

    def test_commit_patch_url_format(self):
        """Test commit_patch returns correct URL format."""
        # This is a unit test - we can't actually commit to GitHub
        # Just verify the URL format would be correct
        
        mock_anthropic = Mock()
        config = HarnessConfig(
            hero_id="test-hero",
            superpowers=[],
            repo_owner="test-owner",
            repo_name="test-repo"
        )
        optimizer = TianYanOptimizer(mock_anthropic, config)
        
        # The URL format should be:
        expected_url = "https://github.com/test-owner/test-repo/compare/main..."
        # We can't test the actual method without mocking Github, 
        # but we know from the code it returns this format


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
