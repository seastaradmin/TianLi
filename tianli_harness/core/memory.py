"""Project memory system for cross-session context persistence."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger(__name__)


@dataclass
class LessonLearned:
    """A lesson learned from a failed or successful run."""

    lesson_id: str
    task_description: str
    lesson_type: str  # success, failure, optimization
    description: str
    recommendation: str
    created_at: datetime = field(default_factory=datetime.now)
    hero_id: Optional[str] = None
    tool_calls: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)


@dataclass
class PreferredPattern:
    """A preferred pattern discovered during execution."""

    pattern_id: str
    category: str  # architecture, coding_style, testing, documentation
    description: str
    example: str
    confidence: float = 1.0  # 0.0-1.0, increases with repeated use
    created_at: datetime = field(default_factory=datetime.now)
    last_used: datetime = field(default_factory=datetime.now)
    usage_count: int = 1


@dataclass
class AntiPattern:
    """An anti-pattern to avoid."""

    pattern_id: str
    category: str
    description: str
    consequence: str
    alternative: str
    created_at: datetime = field(default_factory=datetime.now)
    severity: str = "medium"  # low, medium, high, critical


@dataclass
class ProjectContext:
    """Persistent project context across sessions."""

    project_name: str
    project_path: str
    created_at: datetime = field(default_factory=datetime.now)
    last_updated: datetime = field(default_factory=datetime.now)
    
    # Project metadata
    description: str = ""
    tech_stack: List[str] = field(default_factory=list)
    architecture_notes: str = ""
    
    # Memory components
    lessons_learned: List[LessonLearned] = field(default_factory=list)
    preferred_patterns: List[PreferredPattern] = field(default_factory=list)
    anti_patterns: List[AntiPattern] = field(default_factory=list)
    
    # Hero usage statistics
    hero_usage: Dict[str, int] = field(default_factory=dict)
    
    # Custom context (user-defined)
    custom_context: Dict[str, Any] = field(default_factory=dict)


class ProjectMemory:
    """Project memory manager for cross-session continuity."""

    def __init__(self, project_path: str, memory_dir: str = ".tianli/memory"):
        self.project_path = Path(project_path)
        self.memory_dir = self.project_path / memory_dir
        self.memory_file = self.memory_dir / "project_memory.json"
        self.context: Optional[ProjectContext] = None
        
        # Ensure memory directory exists
        self.memory_dir.mkdir(parents=True, exist_ok=True)

    def load(self) -> ProjectContext:
        """Load project memory from disk."""
        if self.memory_file.exists():
            try:
                content = self.memory_file.read_text(encoding="utf-8")
                data = json.loads(content)
                self.context = self._deserialize_context(data)
                logger.info(f"Loaded project memory from {self.memory_file}")
            except Exception as e:
                logger.warning(f"Failed to load project memory: {e}")
                self.context = None
        
        if not self.context:
            # Create new context
            self.context = ProjectContext(
                project_name=self.project_path.name,
                project_path=str(self.project_path),
            )
            self.save()
        
        return self.context

    def save(self):
        """Save project memory to disk."""
        if not self.context:
            return
        
        self.context.last_updated = datetime.now()
        data = self._serialize_context(self.context)
        
        self.memory_file.write_text(
            json.dumps(data, indent=2, ensure_ascii=False, default=str),
            encoding="utf-8"
        )
        logger.info(f"Saved project memory to {self.memory_file}")

    def add_lesson(self, lesson: LessonLearned):
        """Add a lesson learned."""
        if not self.context:
            self.load()
        
        # Check for duplicate
        existing = next(
            (l for l in self.context.lessons_learned if l.lesson_id == lesson.lesson_id),
            None
        )
        if existing:
            logger.warning(f"Lesson {lesson.lesson_id} already exists, updating")
            existing.description = lesson.description
            existing.recommendation = lesson.recommendation
        else:
            self.context.lessons_learned.append(lesson)
        
        self.save()

    def get_lessons(self, task_type: Optional[str] = None, limit: int = 10) -> List[LessonLearned]:
        """Get lessons learned, optionally filtered by task type."""
        if not self.context:
            self.load()
        
        lessons = self.context.lessons_learned
        
        if task_type:
            lessons = [
                l for l in lessons
                if task_type.lower() in l.task_description.lower()
                or any(task_type.lower() in tag.lower() for tag in l.tags)
            ]
        
        # Sort by recency
        lessons.sort(key=lambda l: l.created_at, reverse=True)
        return lessons[:limit]

    def add_preferred_pattern(self, pattern: PreferredPattern):
        """Add or update a preferred pattern."""
        if not self.context:
            self.load()
        
        existing = next(
            (p for p in self.context.preferred_patterns if p.pattern_id == pattern.pattern_id),
            None
        )
        if existing:
            existing.usage_count += 1
            existing.last_used = datetime.now()
            existing.confidence = min(1.0, existing.confidence + 0.1)
        else:
            self.context.preferred_patterns.append(pattern)
        
        self.save()

    def get_preferred_patterns(self, category: Optional[str] = None) -> List[PreferredPattern]:
        """Get preferred patterns, optionally filtered by category."""
        if not self.context:
            self.load()
        
        patterns = self.context.preferred_patterns
        
        if category:
            patterns = [p for p in patterns if p.category == category]
        
        # Sort by confidence and usage
        patterns.sort(key=lambda p: (p.confidence, p.usage_count), reverse=True)
        return patterns

    def add_anti_pattern(self, anti_pattern: AntiPattern):
        """Add an anti-pattern to avoid."""
        if not self.context:
            self.load()
        
        existing = next(
            (a for a in self.context.anti_patterns if a.pattern_id == anti_pattern.pattern_id),
            None
        )
        if not existing:
            self.context.anti_patterns.append(anti_pattern)
            self.save()

    def get_anti_patterns(self, category: Optional[str] = None) -> List[AntiPattern]:
        """Get anti-patterns, optionally filtered by category."""
        if not self.context:
            self.load()
        
        anti_patterns = self.context.anti_patterns
        
        if category:
            anti_patterns = [a for a in anti_patterns if a.category == category]
        
        return anti_patterns

    def record_hero_usage(self, hero_id: str):
        """Record hero usage for statistics."""
        if not self.context:
            self.load()
        
        self.context.hero_usage[hero_id] = self.context.hero_usage.get(hero_id, 0) + 1
        self.save()

    def get_hero_stats(self) -> Dict[str, int]:
        """Get hero usage statistics."""
        if not self.context:
            self.load()
        
        return self.context.hero_usage

    def get_most_used_heroes(self, limit: int = 5) -> List[tuple]:
        """Get most frequently used heroes."""
        stats = self.get_hero_stats()
        sorted_heroes = sorted(stats.items(), key=lambda x: x[1], reverse=True)
        return sorted_heroes[:limit]

    def set_custom_context(self, key: str, value: Any):
        """Set custom context value."""
        if not self.context:
            self.load()
        
        self.context.custom_context[key] = value
        self.save()

    def get_custom_context(self, key: str, default: Any = None) -> Any:
        """Get custom context value."""
        if not self.context:
            self.load()
        
        return self.context.custom_context.get(key, default)

    def get_context_summary(self) -> str:
        """Get a human-readable summary of project context."""
        if not self.context:
            self.load()
        
        lines = [
            f"# Project Memory: {self.context.project_name}",
            f"Last Updated: {self.context.last_updated.strftime('%Y-%m-%d %H:%M')}",
            "",
            "## Project Info",
            f"- Path: {self.context.project_path}",
            f"- Tech Stack: {', '.join(self.context.tech_stack) if self.context.tech_stack else 'Not specified'}",
            "",
        ]
        
        if self.context.lessons_learned:
            lines.append("## Recent Lessons Learned")
            for lesson in self.context.lessons_learned[-5:]:
                lines.append(f"- [{lesson.lesson_type.upper()}] {lesson.description[:100]}")
            lines.append("")
        
        if self.context.preferred_patterns:
            lines.append("## Preferred Patterns")
            for pattern in self.context.preferred_patterns[:5]:
                lines.append(f"- {pattern.description[:100]} (confidence: {pattern.confidence:.1f})")
            lines.append("")
        
        if self.context.anti_patterns:
            lines.append("## Anti-Patterns to Avoid")
            for anti in self.context.anti_patterns[:5]:
                lines.append(f"- {anti.description[:100]}")
            lines.append("")
        
        if self.context.hero_usage:
            lines.append("## Most Used Heroes")
            for hero_id, count in self.get_most_used_heroes(3):
                lines.append(f"- {hero_id}: {count} times")
            lines.append("")
        
        return "\n".join(lines)

    def inject_context_for_session(self) -> str:
        """Generate context injection prompt for a new session."""
        if not self.context:
            self.load()
        
        parts = [
            "## Project Context (from TianLi Memory)",
            f"Project: {self.context.project_name}",
            f"Path: {self.context.project_path}",
        ]
        
        if self.context.description:
            parts.append(f"Description: {self.context.description}")
        
        if self.context.tech_stack:
            parts.append(f"Tech Stack: {', '.join(self.context.tech_stack)}")
        
        # Add recent lessons
        recent_lessons = self.get_lessons(limit=3)
        if recent_lessons:
            parts.append("")
            parts.append("### Recent Lessons Learned")
            for lesson in recent_lessons:
                parts.append(f"- {lesson.recommendation}")
        
        # Add preferred patterns
        preferred = self.get_preferred_patterns()
        if preferred:
            parts.append("")
            parts.append("### Preferred Patterns")
            for pattern in preferred[:3]:
                parts.append(f"- {pattern.description}")
        
        # Add anti-patterns
        anti_patterns = self.get_anti_patterns()
        if anti_patterns:
            parts.append("")
            parts.append("### Anti-Patterns to Avoid")
            for anti in anti_patterns[:3]:
                parts.append(f"- ⚠️ {anti.description} → {anti.alternative}")
        
        return "\n".join(parts)

    def _serialize_context(self, context: ProjectContext) -> Dict[str, Any]:
        """Serialize context to JSON-serializable dict."""
        return {
            "project_name": context.project_name,
            "project_path": context.project_path,
            "created_at": context.created_at.isoformat(),
            "last_updated": context.last_updated.isoformat(),
            "description": context.description,
            "tech_stack": context.tech_stack,
            "architecture_notes": context.architecture_notes,
            "lessons_learned": [
                {
                    "lesson_id": l.lesson_id,
                    "task_description": l.task_description,
                    "lesson_type": l.lesson_type,
                    "description": l.description,
                    "recommendation": l.recommendation,
                    "created_at": l.created_at.isoformat(),
                    "hero_id": l.hero_id,
                    "tool_calls": l.tool_calls,
                    "tags": l.tags,
                }
                for l in context.lessons_learned
            ],
            "preferred_patterns": [
                {
                    "pattern_id": p.pattern_id,
                    "category": p.category,
                    "description": p.description,
                    "example": p.example,
                    "confidence": p.confidence,
                    "created_at": p.created_at.isoformat(),
                    "last_used": p.last_used.isoformat(),
                    "usage_count": p.usage_count,
                }
                for p in context.preferred_patterns
            ],
            "anti_patterns": [
                {
                    "pattern_id": a.pattern_id,
                    "category": a.category,
                    "description": a.description,
                    "consequence": a.consequence,
                    "alternative": a.alternative,
                    "created_at": a.created_at.isoformat(),
                    "severity": a.severity,
                }
                for a in context.anti_patterns
            ],
            "hero_usage": context.hero_usage,
            "custom_context": context.custom_context,
        }

    def _deserialize_context(self, data: Dict[str, Any]) -> ProjectContext:
        """Deserialize context from dict."""
        return ProjectContext(
            project_name=data["project_name"],
            project_path=data["project_path"],
            created_at=datetime.fromisoformat(data["created_at"]),
            last_updated=datetime.fromisoformat(data["last_updated"]),
            description=data.get("description", ""),
            tech_stack=data.get("tech_stack", []),
            architecture_notes=data.get("architecture_notes", ""),
            lessons_learned=[
                LessonLearned(
                    lesson_id=l["lesson_id"],
                    task_description=l["task_description"],
                    lesson_type=l["lesson_type"],
                    description=l["description"],
                    recommendation=l["recommendation"],
                    created_at=datetime.fromisoformat(l["created_at"]),
                    hero_id=l.get("hero_id"),
                    tool_calls=l.get("tool_calls", []),
                    tags=l.get("tags", []),
                )
                for l in data.get("lessons_learned", [])
            ],
            preferred_patterns=[
                PreferredPattern(
                    pattern_id=p["pattern_id"],
                    category=p["category"],
                    description=p["description"],
                    example=p["example"],
                    confidence=p.get("confidence", 1.0),
                    created_at=datetime.fromisoformat(p["created_at"]),
                    last_used=datetime.fromisoformat(p.get("last_used", p["created_at"])),
                    usage_count=p.get("usage_count", 1),
                )
                for p in data.get("preferred_patterns", [])
            ],
            anti_patterns=[
                AntiPattern(
                    pattern_id=a["pattern_id"],
                    category=a["category"],
                    description=a["description"],
                    consequence=a["consequence"],
                    alternative=a["alternative"],
                    created_at=datetime.fromisoformat(a["created_at"]),
                    severity=a.get("severity", "medium"),
                )
                for a in data.get("anti_patterns", [])
            ],
            hero_usage=data.get("hero_usage", {}),
            custom_context=data.get("custom_context", {}),
        )


# Global memory instance
_project_memory: Optional[ProjectMemory] = None


def get_project_memory(project_path: str) -> ProjectMemory:
    """Get or create project memory instance."""
    global _project_memory
    if _project_memory is None or _project_memory.project_path != project_path:
        _project_memory = ProjectMemory(project_path)
        _project_memory.load()
    return _project_memory


def reset_project_memory():
    """Reset global project memory (for testing)."""
    global _project_memory
    _project_memory = None
