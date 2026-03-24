"""Audit rule templates for TianJie (天劫) layered constitution auditing."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Set
import re


@dataclass
class AuditRule:
    """Single audit rule definition."""

    rule_id: str
    name: str
    description: str
    category: str  # repetition, forbidden, empty, security, alignment
    severity: str  # low, medium, high, critical
    check_fn: Optional[Callable] = None
    enabled: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)


class AuditRuleTemplate:
    """Predefined audit rule templates."""

    # ==================== 重复检测规则 ====================

    REPETITION_TOOL_CALL = AuditRule(
        rule_id="repetition-tool-call",
        name="重复工具调用检测",
        description="检测短时间内重复调用相同工具且参数相似的情况",
        category="repetition",
        severity="medium",
        metadata={"threshold": 3, "similarity_threshold": 0.9},
    )

    REPETITION_PARAMETER = AuditRule(
        rule_id="repetition-parameter",
        description="检测工具调用参数完全重复",
        name="重复参数检测",
        category="repetition",
        severity="low",
        metadata={"window_size": 5},
    )

    # ==================== 禁用词规则 ====================

    FORBIDDEN_DESTRUCTIVE = AuditRule(
        rule_id="forbidden-destructive",
        name="破坏性命令检测",
        description="检测可能破坏系统或数据的命令",
        category="forbidden",
        severity="critical",
        metadata={
            "forbidden_patterns": [
                r"rm\s+(-[rf]+\s+)?/",  # rm -rf /
                r"dd\s+if=/dev/zero",  # dd 清零
                r"mkfs",  # 格式化
                r"DROP\s+TABLE\s+(IF\s+EXISTS\s+)?\w+",  # DROP TABLE
                r"DELETE\s+FROM\s+\w+\s*(;|--)",  # DELETE FROM without WHERE
                r"TRUNCATE\s+\w+",  # TRUNCATE
                r":\(\)\{\s*:\|:&\s*\};:",  # Shell fork bomb
            ]
        },
    )

    FORBIDDEN_SECURITY = AuditRule(
        rule_id="forbidden-security",
        name="安全风险命令检测",
        description="检测可能危及系统安全的命令",
        category="forbidden",
        severity="high",
        metadata={
            "forbidden_patterns": [
                r"chmod\s+777",  # 过度权限
                r"curl.*\|\s*(ba)?sh",  # curl | bash
                r"wget.*\|\s*(ba)?sh",  # wget | bash
                r"sudo\s+rm",  # sudo rm
                r"eval\s*\(",  # eval 执行
                r"exec\s*\(",  # exec 执行
                r"__import__\s*\(",  # Python 动态导入
                r"subprocess\..*shell\s*=\s*True",  # shell=True
            ]
        },
    )

    FORBIDDEN_CUSTOM = AuditRule(
        rule_id="forbidden-custom",
        name="自定义禁用词检测",
        description="检测用户自定义的禁用词",
        category="forbidden",
        severity="medium",
        metadata={"custom_words": []},
    )

    # ==================== 空参数规则 ====================

    EMPTY_PARAMETERS = AuditRule(
        rule_id="empty-parameters",
        name="空参数检测",
        description="检测工具调用参数为空的情况",
        category="empty",
        severity="low",
        metadata={"allow_empty_tools": []},
    )

    MISSING_REQUIRED_PARAM = AuditRule(
        rule_id="missing-required-param",
        name="必需参数缺失检测",
        description="检测工具调用缺少必需参数",
        category="empty",
        severity="medium",
        metadata={
            "required_params": {
                "Write": ["file_path", "content"],
                "Edit": ["file_path", "old_text", "new_text"],
                "Read": ["file_path"],
                "Grep": ["pattern"],
                "Glob": ["pattern"],
                "Bash": ["command"],
            }
        },
    )

    # ==================== 安全审计规则 ====================

    PATH_TRAVERSAL = AuditRule(
        rule_id="path-traversal",
        name="路径遍历检测",
        description="检测尝试访问敏感目录的路径",
        category="security",
        severity="high",
        metadata={
            "sensitive_paths": [
                "/etc/passwd",
                "/etc/shadow",
                "/root/",
                "/.ssh/",
                "/.gnupg/",
                "/proc/",
                "/sys/",
            ],
            "sensitive_patterns": [r"\.\./", r"\.\.\\", r"%2e%2e"],
        },
    )

    SENSITIVE_FILE_ACCESS = AuditRule(
        rule_id="sensitive-file-access",
        name="敏感文件访问检测",
        description="检测尝试读取敏感文件",
        category="security",
        severity="high",
        metadata={
            "sensitive_extensions": [".pem", ".key", ".p12", ".pfx", ".env", ".secret"],
            "sensitive_filenames": [
                "id_rsa",
                "id_ed25519",
                ".gitconfig",
                ".netrc",
                "credentials",
            ],
        },
    )

    COMMAND_INJECTION = AuditRule(
        rule_id="command-injection",
        name="命令注入检测",
        description="检测可能的命令注入攻击",
        category="security",
        severity="critical",
        metadata={
            "injection_patterns": [
                r";\s*\w+",  # 分号后跟命令
                r"\|\s*\w+",  # 管道后跟命令
                r"`[^`]+`",  # 反引号命令替换
                r"\$\([^)]+\)",  # $() 命令替换
                r"&&\s*\w+",  # && 链式命令
                r"\|\|\s*\w+",  # || 链式命令
            ]
        },
    )

    # ==================== 对齐度规则 ====================

    TASK_DRIFT = AuditRule(
        rule_id="task-drift",
        name="任务偏离检测",
        description="检测工具调用与原始任务的相关性",
        category="alignment",
        severity="medium",
        metadata={"min_alignment_score": 0.3},
    )

    CONTEXT_LOSS = AuditRule(
        rule_id="context-loss",
        name="上下文丢失检测",
        description="检测是否忽略了重要的上下文信息",
        category="alignment",
        severity="medium",
        metadata={"check_window": 10},
    )

    # ==================== 性能规则 ====================

    EXPENSIVE_OPERATION = AuditRule(
        rule_id="expensive-operation",
        name="高成本操作检测",
        description="检测可能消耗大量资源的操作",
        category="performance",
        severity="low",
        metadata={
            "expensive_patterns": [
                r"find\s+/",  # 全盘搜索
                r"grep\s+-r\s+/",  # 全盘 grep
                r"du\s+-sh\s+/",  # 全盘大小计算
                r"SELECT\s+\*\s+FROM",  # 全表查询
            ]
        },
    )


class AuditRuleEngine:
    """Audit rule engine for evaluating rules against tool calls."""

    def __init__(self, enabled_rules: Optional[List[AuditRule]] = None):
        self.enabled_rules = enabled_rules or self._get_default_rules()
        self._compile_patterns()

    def _get_default_rules(self) -> List[AuditRule]:
        """Get default enabled rules."""
        template = AuditRuleTemplate()
        return [
            template.REPETITION_TOOL_CALL,
            template.FORBIDDEN_DESTRUCTIVE,
            template.FORBIDDEN_SECURITY,
            template.EMPTY_PARAMETERS,
            template.MISSING_REQUIRED_PARAM,
            template.PATH_TRAVERSAL,
            template.SENSITIVE_FILE_ACCESS,
        ]

    def _compile_patterns(self):
        """Pre-compile regex patterns for performance."""
        for rule in self.enabled_rules:
            if "forbidden_patterns" in rule.metadata:
                rule.metadata["compiled_patterns"] = [
                    re.compile(p, re.IGNORECASE)
                    for p in rule.metadata["forbidden_patterns"]
                ]
            if "sensitive_patterns" in rule.metadata:
                rule.metadata["compiled_patterns"] = [
                    re.compile(p, re.IGNORECASE)
                    for p in rule.metadata["sensitive_patterns"]
                ]
            if "injection_patterns" in rule.metadata:
                rule.metadata["compiled_patterns"] = [
                    re.compile(p, re.IGNORECASE)
                    for p in rule.metadata["injection_patterns"]
                ]
            if "expensive_patterns" in rule.metadata:
                rule.metadata["compiled_patterns"] = [
                    re.compile(p, re.IGNORECASE)
                    for p in rule.metadata["expensive_patterns"]
                ]

    def check(
        self,
        tool_name: str,
        parameters: Dict[str, Any],
        traces: List[Any],
        original_prompt: str = "",
        conversation_history: List[Dict] = None,
    ) -> List[Dict[str, Any]]:
        """
        Check tool call against all enabled rules.

        Returns list of violations (empty if all checks pass).
        """
        violations = []

        for rule in self.enabled_rules:
            if not rule.enabled:
                continue

            violation = self._check_rule(rule, tool_name, parameters, traces, original_prompt, conversation_history)
            if violation:
                violations.append(violation)

        return violations

    def _check_rule(
        self,
        rule: AuditRule,
        tool_name: str,
        parameters: Dict[str, Any],
        traces: List[Any],
        original_prompt: str,
        conversation_history: List[Dict],
    ) -> Optional[Dict[str, Any]]:
        """Check single rule and return violation if found."""

        if rule.category == "repetition":
            return self._check_repetition(rule, tool_name, parameters, traces)
        elif rule.category == "forbidden":
            return self._check_forbidden(rule, tool_name, parameters)
        elif rule.category == "empty":
            return self._check_empty(rule, tool_name, parameters)
        elif rule.category == "security":
            return self._check_security(rule, tool_name, parameters)
        elif rule.category == "alignment":
            return self._check_alignment(rule, tool_name, parameters, original_prompt, conversation_history)
        elif rule.category == "performance":
            return self._check_performance(rule, tool_name, parameters)

        return None

    def _check_repetition(
        self,
        rule: AuditRule,
        tool_name: str,
        parameters: Dict[str, Any],
        traces: List[Any],
    ) -> Optional[Dict[str, Any]]:
        """Check repetition rules."""
        if rule.rule_id == "repetition-tool-call":
            threshold = rule.metadata.get("threshold", 3)
            similarity_threshold = rule.metadata.get("similarity_threshold", 0.9)

            if len(traces) < threshold:
                return None

            recent_traces = traces[-threshold:]
            if not all(trace.tool_name == tool_name for trace in recent_traces):
                return None

            # Check parameter similarity
            import difflib
            current_str = str(parameters)
            previous_params = str(recent_traces[-1].parameters or recent_traces[-1].observation or {})
            similarity = difflib.SequenceMatcher(None, current_str, previous_params).ratio()

            if similarity > similarity_threshold:
                return {
                    "rule_id": rule.rule_id,
                    "name": rule.name,
                    "severity": rule.severity,
                    "reason": f"Repetition detected: {similarity:.2f} similar parameters for {tool_name}",
                    "metadata": {"similarity": similarity, "threshold": similarity_threshold},
                }

        return None

    def _check_forbidden(
        self,
        rule: AuditRule,
        tool_name: str,
        parameters: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """Check forbidden word/pattern rules."""
        content = f"{tool_name} {parameters}".lower()

        # Check custom forbidden words
        if rule.rule_id == "forbidden-custom":
            custom_words = rule.metadata.get("custom_words", [])
            for word in custom_words:
                if word.lower() in content:
                    return {
                        "rule_id": rule.rule_id,
                        "name": rule.name,
                        "severity": rule.severity,
                        "reason": f"Forbidden word '{word}' detected",
                    }

        # Check regex patterns
        compiled_patterns = rule.metadata.get("compiled_patterns", [])
        for pattern in compiled_patterns:
            if pattern.search(content):
                return {
                    "rule_id": rule.rule_id,
                    "name": rule.name,
                    "severity": rule.severity,
                    "reason": f"Forbidden pattern detected: {pattern.pattern}",
                }

        return None

    def _check_empty(
        self,
        rule: AuditRule,
        tool_name: str,
        parameters: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """Check empty parameter rules."""
        if rule.rule_id == "empty-parameters":
            if not parameters or all(v is None or v == "" for v in parameters.values()):
                allow_empty = rule.metadata.get("allow_empty_tools", [])
                if tool_name not in allow_empty:
                    return {
                        "rule_id": rule.rule_id,
                        "name": rule.name,
                        "severity": rule.severity,
                        "reason": "Empty parameters detected",
                    }

        elif rule.rule_id == "missing-required-param":
            required_params = rule.metadata.get("required_params", {})
            tool_required = required_params.get(tool_name, [])

            for param in tool_required:
                if param not in parameters or parameters[param] in (None, ""):
                    return {
                        "rule_id": rule.rule_id,
                        "name": rule.name,
                        "severity": rule.severity,
                        "reason": f"Missing required parameter '{param}' for tool {tool_name}",
                    }

        return None

    def _check_security(
        self,
        rule: AuditRule,
        tool_name: str,
        parameters: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """Check security rules."""
        content = f"{tool_name} {parameters}".lower()

        if rule.rule_id == "path-traversal":
            sensitive_paths = rule.metadata.get("sensitive_paths", [])
            sensitive_patterns = rule.metadata.get("compiled_patterns", [])

            for path in sensitive_paths:
                if path.lower() in content:
                    return {
                        "rule_id": rule.rule_id,
                        "name": rule.name,
                        "severity": rule.severity,
                        "reason": f"Sensitive path detected: {path}",
                    }

            for pattern in sensitive_patterns:
                if pattern.search(content):
                    return {
                        "rule_id": rule.rule_id,
                        "name": rule.name,
                        "severity": rule.severity,
                        "reason": f"Path traversal pattern detected",
                    }

        elif rule.rule_id == "sensitive-file-access":
            sensitive_extensions = rule.metadata.get("sensitive_extensions", [])
            sensitive_filenames = rule.metadata.get("sensitive_filenames", [])

            for ext in sensitive_extensions:
                if ext.lower() in content:
                    return {
                        "rule_id": rule.rule_id,
                        "name": rule.name,
                        "severity": rule.severity,
                        "reason": f"Sensitive file extension detected: {ext}",
                    }

            for filename in sensitive_filenames:
                if filename.lower() in content:
                    return {
                        "rule_id": rule.rule_id,
                        "name": rule.name,
                        "severity": rule.severity,
                        "reason": f"Sensitive filename detected: {filename}",
                    }

        elif rule.rule_id == "command-injection":
            injection_patterns = rule.metadata.get("compiled_patterns", [])
            for pattern in injection_patterns:
                if pattern.search(content):
                    return {
                        "rule_id": rule.rule_id,
                        "name": rule.name,
                        "severity": rule.severity,
                        "reason": f"Command injection pattern detected",
                    }

        return None

    def _check_alignment(
        self,
        rule: AuditRule,
        tool_name: str,
        parameters: Dict[str, Any],
        original_prompt: str,
        conversation_history: List[Dict],
    ) -> Optional[Dict[str, Any]]:
        """Check alignment rules (simplified heuristic)."""
        # This is a simplified version - full implementation would use LLM
        if rule.rule_id == "task-drift":
            if not original_prompt:
                return None

            task_terms = set(self._tokenize(original_prompt))
            tool_terms = set(self._tokenize(f"{tool_name} {parameters}"))

            if not tool_terms:
                return {
                    "rule_id": rule.rule_id,
                    "name": rule.name,
                    "severity": rule.severity,
                    "reason": "No meaningful tool parameters to compare",
                }

            overlap = len(task_terms & tool_terms)
            alignment_score = min(1.0, 0.2 + overlap * 0.15)
            min_score = rule.metadata.get("min_alignment_score", 0.3)

            if alignment_score < min_score:
                return {
                    "rule_id": rule.rule_id,
                    "name": rule.name,
                    "severity": rule.severity,
                    "reason": f"Low alignment score: {alignment_score:.2f} < {min_score:.2f}",
                    "metadata": {"alignment_score": alignment_score},
                }

        return None

    def _check_performance(
        self,
        rule: AuditRule,
        tool_name: str,
        parameters: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """Check performance rules."""
        content = f"{tool_name} {parameters}".lower()
        expensive_patterns = rule.metadata.get("compiled_patterns", [])

        for pattern in expensive_patterns:
            if pattern.search(content):
                return {
                    "rule_id": rule.rule_id,
                    "name": rule.name,
                    "severity": rule.severity,
                    "reason": f"Expensive operation detected: {pattern.pattern}",
                }

        return None

    def _tokenize(self, text: str) -> List[str]:
        """Tokenize text for comparison."""
        import re
        return [token.lower() for token in re.findall(r"[\w\u4e00-\u9fff]+", text)]

    def add_rule(self, rule: AuditRule):
        """Add a custom rule."""
        self.enabled_rules.append(rule)
        self._compile_patterns()

    def remove_rule(self, rule_id: str):
        """Remove a rule by ID."""
        self.enabled_rules = [r for r in self.enabled_rules if r.rule_id != rule_id]

    def enable_rule(self, rule_id: str):
        """Enable a rule."""
        for rule in self.enabled_rules:
            if rule.rule_id == rule_id:
                rule.enabled = True

    def disable_rule(self, rule_id: str):
        """Disable a rule."""
        for rule in self.enabled_rules:
            if rule.rule_id == rule_id:
                rule.enabled = False

    def get_rules_by_category(self, category: str) -> List[AuditRule]:
        """Get all rules in a category."""
        return [r for r in self.enabled_rules if r.category == category]

    def get_rules_by_severity(self, severity: str) -> List[AuditRule]:
        """Get all rules with a severity level."""
        return [r for r in self.enabled_rules if r.severity == severity]
