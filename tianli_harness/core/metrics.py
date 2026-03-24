"""Metrics collection and reporting for TianLi Harness."""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class SessionMetrics:
    """Metrics for a single TianLi Harness session."""

    session_id: str
    start_time: datetime = field(default_factory=datetime.now)
    end_time: Optional[datetime] = None

    # Request counts
    total_requests: int = 0
    successful_completions: int = 0
    early_exits: int = 0

    # L1 audit results
    l1_checks: int = 0
    l1_passed: int = 0
    l1_failed: int = 0

    # L2 audit results
    l2_checks: int = 0
    l2_passed: int = 0
    l2_failed: int = 0
    l2_scores: List[float] = field(default_factory=list)

    # Tool call statistics
    tool_calls: Dict[str, int] = field(default_factory=dict)
    tool_latencies_ms: Dict[str, List[int]] = field(default_factory=dict)

    # Audit violations
    violations: List[Dict[str, Any]] = field(default_factory=list)

    # Evolution patches
    evolution_patches_generated: int = 0

    @property
    def duration_seconds(self) -> float:
        """Calculate session duration."""
        end = self.end_time or datetime.now()
        return (end - self.start_time).total_seconds()

    @property
    def l1_pass_rate(self) -> float:
        """Calculate L1 pass rate."""
        total = self.l1_passed + self.l1_failed
        return self.l1_passed / total if total > 0 else 1.0

    @property
    def l2_pass_rate(self) -> float:
        """Calculate L2 pass rate."""
        total = self.l2_passed + self.l2_failed
        return self.l2_passed / total if total > 0 else 1.0

    @property
    def avg_l2_score(self) -> float:
        """Calculate average L2 alignment score."""
        return sum(self.l2_scores) / len(self.l2_scores) if self.l2_scores else 0.0

    @property
    def early_exit_rate(self) -> float:
        """Calculate early exit rate."""
        return self.early_exits / self.total_requests if self.total_requests > 0 else 0.0

    @property
    def avg_tool_latency_ms(self) -> Dict[str, int]:
        """Calculate average latency per tool."""
        result = {}
        for tool, latencies in self.tool_latencies_ms.items():
            if latencies:
                result[tool] = sum(latencies) // len(latencies)
        return result

    @property
    def total_tool_calls(self) -> int:
        """Get total number of tool calls."""
        return sum(self.tool_calls.values())

    def record_request_start(self):
        """Record start of a new request."""
        self.total_requests += 1

    def record_l1_result(self, passed: bool):
        """Record L1 audit result."""
        self.l1_checks += 1
        if passed:
            self.l1_passed += 1
        else:
            self.l1_failed += 1

    def record_l2_result(self, passed: bool, score: float):
        """Record L2 audit result."""
        self.l2_checks += 1
        if passed:
            self.l2_passed += 1
        else:
            self.l2_failed += 1
        self.l2_scores.append(score)

    def record_tool_call(self, tool_name: str, latency_ms: int):
        """Record tool call with latency."""
        self.tool_calls[tool_name] = self.tool_calls.get(tool_name, 0) + 1
        if tool_name not in self.tool_latencies_ms:
            self.tool_latencies_ms[tool_name] = []
        self.tool_latencies_ms[tool_name].append(latency_ms)

    def record_early_exit(self, reason: str, violation: Optional[Dict] = None):
        """Record early exit event."""
        self.early_exits += 1
        if violation:
            self.violations.append({
                "timestamp": datetime.now().isoformat(),
                "reason": reason,
                "violation": violation,
            })

    def record_evolution_patch(self):
        """Record evolution patch generation."""
        self.evolution_patches_generated += 1

    def record_completion(self):
        """Record successful completion."""
        self.successful_completions += 1
        self.end_time = datetime.now()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "session_id": self.session_id,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_seconds": round(self.duration_seconds, 2),
            "total_requests": self.total_requests,
            "successful_completions": self.successful_completions,
            "early_exits": self.early_exits,
            "early_exit_rate": round(self.early_exit_rate, 3),
            "l1": {
                "checks": self.l1_checks,
                "passed": self.l1_passed,
                "failed": self.l1_failed,
                "pass_rate": round(self.l1_pass_rate, 3),
            },
            "l2": {
                "checks": self.l2_checks,
                "passed": self.l2_passed,
                "failed": self.l2_failed,
                "pass_rate": round(self.l2_pass_rate, 3),
                "avg_score": round(self.avg_l2_score, 3),
            },
            "tool_calls": {
                "total": self.total_tool_calls,
                "by_tool": self.tool_calls,
                "avg_latency_ms": self.avg_tool_latency_ms,
            },
            "violations": self.violations,
            "evolution_patches": self.evolution_patches_generated,
        }

    def save(self, path: str):
        """Save metrics to JSON file."""
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2, ensure_ascii=False)

    @classmethod
    def load(cls, path: str) -> "SessionMetrics":
        """Load metrics from JSON file."""
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        return cls(
            session_id=data["session_id"],
            start_time=datetime.fromisoformat(data["start_time"]),
            end_time=datetime.fromisoformat(data["end_time"]) if data["end_time"] else None,
            total_requests=data["total_requests"],
            successful_completions=data["successful_completions"],
            early_exits=data["early_exits"],
            l1_passed=data["l1"]["passed"],
            l1_failed=data["l1"]["failed"],
            l2_passed=data["l2"]["passed"],
            l2_failed=data["l2"]["failed"],
            l2_scores=[],  # Cannot reconstruct from aggregated data
            tool_calls=data["tool_calls"]["by_tool"],
            violations=data["violations"],
            evolution_patches_generated=data["evolution_patches"],
        )


@dataclass
class AggregateMetrics:
    """Aggregated metrics across multiple sessions."""

    sessions: List[SessionMetrics] = field(default_factory=list)
    start_date: datetime = field(default_factory=datetime.now)
    end_date: Optional[datetime] = None

    @property
    def total_sessions(self) -> int:
        """Get total number of sessions."""
        return len(self.sessions)

    @property
    def total_requests(self) -> int:
        """Get total requests across all sessions."""
        return sum(s.total_requests for s in self.sessions)

    @property
    def total_early_exits(self) -> int:
        """Get total early exits across all sessions."""
        return sum(s.early_exits for s in self.sessions)

    @property
    def avg_early_exit_rate(self) -> float:
        """Calculate average early exit rate."""
        if not self.sessions:
            return 0.0
        return sum(s.early_exit_rate for s in self.sessions) / len(self.sessions)

    @property
    def avg_l1_pass_rate(self) -> float:
        """Calculate average L1 pass rate."""
        if not self.sessions:
            return 0.0
        return sum(s.l1_pass_rate for s in self.sessions) / len(self.sessions)

    @property
    def avg_l2_pass_rate(self) -> float:
        """Calculate average L2 pass rate."""
        if not self.sessions:
            return 0.0
        return sum(s.l2_pass_rate for s in self.sessions) / len(self.sessions)

    @property
    def avg_l2_score(self) -> float:
        """Calculate average L2 alignment score."""
        all_scores = []
        for s in self.sessions:
            all_scores.extend(s.l2_scores)
        return sum(all_scores) / len(all_scores) if all_scores else 0.0

    @property
    def total_violations(self) -> int:
        """Get total violations across all sessions."""
        return sum(len(s.violations) for s in self.sessions)

    @property
    def total_evolution_patches(self) -> int:
        """Get total evolution patches generated."""
        return sum(s.evolution_patches_generated for s in self.sessions)

    def add_session(self, metrics: SessionMetrics):
        """Add a session to the aggregate."""
        self.sessions.append(metrics)
        self.end_date = datetime.now()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "summary": {
                "total_sessions": self.total_sessions,
                "total_requests": self.total_requests,
                "total_early_exits": self.total_early_exits,
                "avg_early_exit_rate": round(self.avg_early_exit_rate, 3),
                "avg_l1_pass_rate": round(self.avg_l1_pass_rate, 3),
                "avg_l2_pass_rate": round(self.avg_l2_pass_rate, 3),
                "avg_l2_score": round(self.avg_l2_score, 3),
                "total_violations": self.total_violations,
                "total_evolution_patches": self.total_evolution_patches,
            },
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat() if self.end_date else None,
        }

    def save(self, path: str):
        """Save aggregate metrics to JSON file."""
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2, ensure_ascii=False)


class MetricsCollector:
    """Centralized metrics collection for TianLi Harness."""

    def __init__(self, metrics_dir: str = "./tianli_harness/metrics"):
        self.metrics_dir = Path(metrics_dir)
        self.metrics_dir.mkdir(parents=True, exist_ok=True)
        self.current_session: Optional[SessionMetrics] = None
        self.aggregate = AggregateMetrics()

    def start_session(self, session_id: str) -> SessionMetrics:
        """Start a new metrics session."""
        self.current_session = SessionMetrics(session_id=session_id)
        return self.current_session

    def get_current_session(self) -> Optional[SessionMetrics]:
        """Get current session metrics."""
        return self.current_session

    def end_session(self) -> Optional[SessionMetrics]:
        """End current session and save metrics."""
        if not self.current_session:
            return None

        self.current_session.record_completion()

        # Save session metrics
        session_path = self.metrics_dir / f"{self.current_session.session_id}.json"
        self.current_session.save(str(session_path))

        # Add to aggregate
        self.aggregate.add_session(self.current_session)

        # Save aggregate
        aggregate_path = self.metrics_dir / "aggregate.json"
        self.aggregate.save(str(aggregate_path))

        session = self.current_session
        self.current_session = None
        return session

    def record_l1_result(self, passed: bool):
        """Record L1 audit result for current session."""
        if self.current_session:
            self.current_session.record_l1_result(passed)

    def record_l2_result(self, passed: bool, score: float):
        """Record L2 audit result for current session."""
        if self.current_session:
            self.current_session.record_l2_result(passed, score)

    def record_tool_call(self, tool_name: str, latency_ms: int):
        """Record tool call for current session."""
        if self.current_session:
            self.current_session.record_tool_call(tool_name, latency_ms)

    def record_early_exit(self, reason: str, violation: Optional[Dict] = None):
        """Record early exit for current session."""
        if self.current_session:
            self.current_session.record_early_exit(reason, violation)

    def record_evolution_patch(self):
        """Record evolution patch generation."""
        if self.current_session:
            self.current_session.record_evolution_patch()

    def get_summary(self) -> Dict[str, Any]:
        """Get current metrics summary."""
        if not self.current_session:
            return self.aggregate.to_dict()["summary"]

        return {
            "current_session": self.current_session.to_dict(),
            "aggregate": self.aggregate.to_dict()["summary"],
        }

    def export_report(self, output_path: str) -> str:
        """Export a human-readable metrics report."""
        report_lines = [
            "# TianLi Harness Metrics Report",
            f"Generated: {datetime.now().isoformat()}",
            "",
            "## Aggregate Summary",
            f"- Total Sessions: {self.aggregate.total_sessions}",
            f"- Total Requests: {self.aggregate.total_requests}",
            f"- Average Early Exit Rate: {self.aggregate.avg_early_exit_rate:.1%}",
            f"- Average L1 Pass Rate: {self.aggregate.avg_l1_pass_rate:.1%}",
            f"- Average L2 Pass Rate: {self.aggregate.avg_l2_pass_rate:.1%}",
            f"- Average L2 Alignment Score: {self.aggregate.avg_l2_score:.2f}",
            f"- Total Violations: {self.aggregate.total_violations}",
            f"- Total Evolution Patches: {self.aggregate.total_evolution_patches}",
            "",
        ]

        if self.current_session:
            report_lines.extend([
                "## Current Session",
                f"- Session ID: {self.current_session.session_id}",
                f"- Duration: {self.current_session.duration_seconds:.1f}s",
                f"- Total Requests: {self.current_session.total_requests}",
                f"- L1 Pass Rate: {self.current_session.l1_pass_rate:.1%}",
                f"- L2 Pass Rate: {self.current_session.l2_pass_rate:.1%}",
                f"- Early Exits: {self.current_session.early_exits}",
                f"- Tool Calls: {self.current_session.total_tool_calls}",
                "",
            ])

        report_content = "\n".join(report_lines)

        output_path_obj = Path(output_path)
        output_path_obj.parent.mkdir(parents=True, exist_ok=True)
        output_path_obj.write_text(report_content, encoding="utf-8")

        return report_content


# Global metrics collector instance
_metrics_collector: Optional[MetricsCollector] = None


def get_metrics_collector(metrics_dir: str = "./tianli_harness/metrics") -> MetricsCollector:
    """Get or create global metrics collector."""
    global _metrics_collector
    if _metrics_collector is None:
        _metrics_collector = MetricsCollector(metrics_dir)
    return _metrics_collector


def reset_metrics_collector():
    """Reset global metrics collector (for testing)."""
    global _metrics_collector
    _metrics_collector = None
