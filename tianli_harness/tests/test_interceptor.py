"""Unit tests for TianJie Interceptor."""

import pytest
from tianli_harness.core.interceptor import TianJieInterceptor, AuditResult
from tianli_harness.core.state import HarnessConfig, ActionTrace


class TestTianJieInterceptor:
    """Tests for TianJieInterceptor class."""

    def test_l1_repetition_trigger(self):
        """Test L1 repetition detection."""
        config = HarnessConfig(
            hero_id="test",
            superpowers=["Read"],
            repetition_threshold=3
        )
        interceptor = TianJieInterceptor(None, config)
        
        # Create 3 repeated tool calls with similar parameters
        traces = [
            ActionTrace(step=1, tool_name="Read", observation="{'file_path': 'test.py'}"),
            ActionTrace(step=2, tool_name="Read", observation="{'file_path': 'test.py'}"),
            ActionTrace(step=3, tool_name="Read", observation="{'file_path': 'test.py'}"),
        ]
        
        result = interceptor.check_l1("Read", {"file_path": "test.py"}, traces)
        
        assert result.should_continue == False
        assert "Repetition detected" in result.reason

    def test_l1_passed(self):
        """Test L1 checks passing with varied tools."""
        config = HarnessConfig(
            hero_id="test",
            superpowers=["Read"]
        )
        interceptor = TianJieInterceptor(None, config)
        
        traces = [
            ActionTrace(step=1, tool_name="Read", observation="{'file_path': 'a.py'}"),
            ActionTrace(step=2, tool_name="Glob", observation="{'pattern': '*.py'}"),
        ]
        
        result = interceptor.check_l1("Grep", {"pattern": "test"}, traces)
        
        assert result.should_continue == True
        assert result.reason == "L1: All checks passed"

    def test_l1_forbidden_word(self):
        """Test L1 forbidden word detection."""
        config = HarnessConfig(
            hero_id="test",
            superpowers=["Bash"],
            forbidden_words=["rm -rf", "sudo"]
        )
        interceptor = TianJieInterceptor(None, config)
        
        traces = []
        
        # Test with forbidden word
        result = interceptor.check_l1("Bash", {"command": "rm -rf /tmp/*"}, traces)
        
        assert result.should_continue == False
        assert "Forbidden word" in result.reason

    def test_l1_empty_parameters(self):
        """Test L1 empty parameters detection."""
        config = HarnessConfig(
            hero_id="test",
            superpowers=["Read"]
        )
        interceptor = TianJieInterceptor(None, config)
        
        traces = []
        
        # Test with empty dict
        result = interceptor.check_l1("Read", {}, traces)
        
        assert result.should_continue == False
        assert "Empty parameters" in result.reason
        
        # Test with all None values
        result2 = interceptor.check_l1("Read", {"file": None, "path": ""}, traces)
        
        assert result2.should_continue == False

    def test_l1_repetition_different_tools(self):
        """Test L1 doesn't trigger on different tools."""
        config = HarnessConfig(
            hero_id="test",
            superpowers=["Read"],
            repetition_threshold=3
        )
        interceptor = TianJieInterceptor(None, config)
        
        traces = [
            ActionTrace(step=1, tool_name="Read", observation="{'file_path': 'a.py'}"),
            ActionTrace(step=2, tool_name="Glob", observation="{'pattern': '*.py'}"),
            ActionTrace(step=3, tool_name="Grep", observation="{'pattern': 'test'}"),
        ]
        
        result = interceptor.check_l1("Read", {"file_path": "b.py"}, traces)
        
        assert result.should_continue == True

    def test_l1_repetition_different_params(self):
        """Test L1 doesn't trigger when params are significantly different."""
        config = HarnessConfig(
            hero_id="test",
            superpowers=["Read"],
            repetition_threshold=3
        )
        interceptor = TianJieInterceptor(None, config)
        
        # Use very different file paths to ensure low similarity
        traces = [
            ActionTrace(step=1, tool_name="Read", observation="{'file_path': '/very/long/path/to/src/components/Button.tsx'}"),
            ActionTrace(step=2, tool_name="Read", observation="{'file_path': '/very/long/path/to/src/utils/helpers.py'}"),
            ActionTrace(step=3, tool_name="Read", observation="{'file_path': '/very/long/path/to/tests/test_api.py'}"),
        ]
        
        result = interceptor.check_l1("Read", {"file_path": "/completely/different/config.json"}, traces)
        
        # Should pass because parameters are different enough (longer strings = better diff)
        assert result.should_continue == True

    def test_should_do_l2_check(self):
        """Test L2 sampling logic."""
        # 100% sampling
        config = HarnessConfig(hero_id="test", superpowers=[], l2_sample_ratio=1.0)
        interceptor = TianJieInterceptor(None, config)
        assert interceptor.should_do_l2_check() == True
        
        # 0% sampling
        config = HarnessConfig(hero_id="test", superpowers=[], l2_sample_ratio=0.0)
        interceptor = TianJieInterceptor(None, config)
        assert interceptor.should_do_l2_check() == False
        
        # 50% sampling - test multiple times to ensure randomness works
        config = HarnessConfig(hero_id="test", superpowers=[], l2_sample_ratio=0.5)
        interceptor = TianJieInterceptor(None, config)
        results = [interceptor.should_do_l2_check() for _ in range(100)]
        # Should have some True and some False
        assert any(results) and not all(results)

    def test_audit_result_model(self):
        """Test AuditResult pydantic model."""
        result = AuditResult(
            should_continue=False,
            reason="Test reason",
            score=0.5
        )
        
        assert result.should_continue == False
        assert result.reason == "Test reason"
        assert result.score == 0.5
        
        # Test without score
        result2 = AuditResult(
            should_continue=True,
            reason="Passed"
        )
        
        assert result2.should_continue == True
        assert result2.score is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
