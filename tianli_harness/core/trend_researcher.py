"""
Trend Researcher - Daily research on star-history.com and GitHub trending.

This module automatically discovers inspiring projects, analyzes their features,
and absorbs best practices into the project knowledge base.
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional
import httpx

from tianli_harness.core.memory import get_project_memory, LessonLearned

logger = logging.getLogger(__name__)


@dataclass
class TrendingProject:
    """A trending project discovered from star-history.com or GitHub."""
    
    name: str
    full_name: str
    url: str
    stars: int
    stars_today: int
    growth_rate: float  # percentage
    description: str
    language: str
    topics: List[str] = field(default_factory=list)
    key_features: List[str] = field(default_factory=list)
    lessons_learned: List[str] = field(default_factory=list)
    researched_at: datetime = field(default_factory=datetime.now)


class StarHistoryScraper:
    """Scrape trending projects from star-history.com."""
    
    def __init__(self):
        self.base_url = "https://www.star-history.com"
        self.api_url = "https://api.star-history.com"
    
    async def fetch_trending_projects(self, limit: int = 10) -> List[TrendingProject]:
        """
        Fetch trending projects from star-history.com.
        
        Note: star-history.com doesn't have a public API, so we use
        GitHub API as a proxy to find projects with high star growth.
        """
        logger.info(f"Fetching trending projects from GitHub API (proxy for star-history)...")
        
        try:
            # Use GitHub API to find trending projects
            # Search for projects with high star growth in last 7 days
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Search for trending projects (created recently with many stars)
                query = "stars:>1000 created:>=2026-01-01 language:python,language:typescript,language:javascript"
                response = await client.get(
                    "https://api.github.com/search/repositories",
                    params={
                        "q": query,
                        "sort": "stars",
                        "order": "desc",
                        "per_page": limit,
                    },
                    headers={
                        "Accept": "application/vnd.github.v3+json",
                    }
                )
                
                if response.status_code != 200:
                    logger.warning(f"GitHub API returned {response.status_code}")
                    return []
                
                data = response.json()
                projects = []
                
                for item in data.get("items", [])[:limit]:
                    project = TrendingProject(
                        name=item["name"],
                        full_name=item["full_name"],
                        url=item["html_url"],
                        stars=item["stargazers_count"],
                        stars_today=0,  # Would need historical data
                        growth_rate=0.0,
                        description=item.get("description", "") or "",
                        language=item.get("language", ""),
                        topics=item.get("topics", []),
                    )
                    projects.append(project)
                
                logger.info(f"Found {len(projects)} trending projects")
                return projects
                
        except Exception as e:
            logger.error(f"Failed to fetch trending projects: {e}")
            return []
    
    async def analyze_project(self, project: TrendingProject) -> TrendingProject:
        """
        Analyze a project to extract key features and lessons.
        """
        logger.info(f"Analyzing project: {project.full_name}")
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Fetch README
                readme_url = f"https://raw.githubusercontent.com/{project.full_name}/main/README.md"
                response = await client.get(readme_url)
                
                if response.status_code == 200:
                    readme_content = response.text
                    
                    # Extract key features from README
                    project.key_features = self._extract_features(readme_content)
                    project.lessons_learned = self._extract_lessons(readme_content, project)
                
                return project
                
        except Exception as e:
            logger.error(f"Failed to analyze project {project.full_name}: {e}")
            return project
    
    def _extract_features(self, readme_content: str) -> List[str]:
        """Extract key features from README content."""
        features = []
        
        # Look for feature sections
        lines = readme_content.split("\n")
        in_features = False
        
        for line in lines:
            line_lower = line.lower()
            
            # Detect feature section headers
            if any(keyword in line_lower for keyword in ["features", "capabilities", "highlights", "why"]):
                in_features = True
                continue
            
            if in_features:
                # Extract list items
                if line.strip().startswith(("- ", "* ", "✅", "🔹")):
                    feature = line.strip().lstrip("- *").lstrip("✅").lstrip("🔹").strip()
                    if len(feature) > 10 and len(feature) < 200:
                        features.append(feature)
                
                # Stop at next section
                if line.startswith("#") and len(line) < 50:
                    break
        
        return features[:10]  # Limit to top 10 features
    
    def _extract_lessons(self, readme_content: str, project: TrendingProject) -> List[str]:
        """Extract lessons learned from project."""
        lessons = []
        
        # Analyze project structure and features
        if "design system" in readme_content.lower():
            lessons.append("Design system generation improves consistency and reduces development time")
        
        if "component" in readme_content.lower() and "library" in readme_content.lower():
            lessons.append("Component libraries with pre-built patterns accelerate UI development")
        
        if "accessibility" in readme_content.lower() or "wcag" in readme_content.lower():
            lessons.append("Accessibility compliance (WCAG) should be built-in, not an afterthought")
        
        if "typescript" in readme_content.lower():
            lessons.append("TypeScript improves code quality and developer experience")
        
        if project.language == "Python" and "fastapi" in readme_content.lower():
            lessons.append("FastAPI provides excellent performance for Python backends")
        
        # Add project-specific lessons
        if project.stars > 10000:
            lessons.append(f"Projects with clear value proposition can reach {project.stars:,} stars")
        
        return lessons


class TrendResearcher:
    """
    Daily trend researcher that discovers and absorbs knowledge from trending projects.
    """
    
    def __init__(self, project_path: str = "."):
        self.project_path = project_path
        self.scraper = StarHistoryScraper()
        self.memory = get_project_memory(project_path)
        self.research_log_path = Path(project_path) / ".tianli" / "trend_research"
        self.research_log_path.mkdir(parents=True, exist_ok=True)
    
    async def daily_research(self, save_to_memory: bool = True) -> Dict[str, Any]:
        """
        Perform daily trend research.
        
        Args:
            save_to_memory: Whether to save findings to project memory
        
        Returns:
            Research report dictionary
        """
        logger.info("Starting daily trend research...")
        
        report = {
            "date": datetime.now().isoformat(),
            "projects_discovered": [],
            "insights": [],
            "knowledge_updates": [],
        }
        
        # Fetch trending projects
        projects = await self.scraper.fetch_trending_projects(limit=10)
        
        if not projects:
            logger.warning("No trending projects found")
            return report
        
        # Analyze each project
        for project in projects:
            logger.info(f"Researching: {project.name} ({project.stars:,} stars)")
            
            # Analyze project
            analyzed_project = await self.scraper.analyze_project(project)
            
            # Add to report
            project_data = {
                "name": analyzed_project.name,
                "full_name": analyzed_project.full_name,
                "url": analyzed_project.url,
                "stars": analyzed_project.stars,
                "language": analyzed_project.language,
                "key_features": analyzed_project.key_features,
                "lessons_learned": analyzed_project.lessons_learned,
            }
            report["projects_discovered"].append(project_data)
            
            # Extract insights
            for lesson in analyzed_project.lessons_learned:
                report["insights"].append({
                    "source": analyzed_project.name,
                    "insight": lesson,
                })
            
            # Save to memory
            if save_to_memory:
                for lesson in analyzed_project.lessons_learned:
                    self.memory.add_lesson(LessonLearned(
                        lesson_id=f"trend-{analyzed_project.name}-{int(datetime.now().timestamp())}",
                        task_description=f"Trend research: {analyzed_project.name}",
                        lesson_type="success",
                        description=lesson,
                        recommendation=f"Consider adopting: {lesson}",
                        tags=["trend-research", "best-practice", analyzed_project.language.lower()],
                    ))
        
        # Generate actionable insights
        report["knowledge_updates"] = self._generate_knowledge_updates(report)
        
        # Save report to file
        self._save_report(report)
        
        logger.info(f"Daily research complete: {len(report['projects_discovered'])} projects analyzed")
        
        return report
    
    def _generate_knowledge_updates(self, report: Dict[str, Any]) -> List[Dict[str, str]]:
        """Generate knowledge base updates from research."""
        updates = []
        
        # Count feature patterns across projects
        feature_counts: Dict[str, int] = {}
        for project in report["projects_discovered"]:
            for feature in project.get("key_features", []):
                # Normalize feature
                feature_lower = feature.lower()
                if "design" in feature_lower:
                    feature_counts["design_system"] = feature_counts.get("design_system", 0) + 1
                if "component" in feature_lower:
                    feature_counts["components"] = feature_counts.get("components", 0) + 1
                if "type" in feature_lower:
                    feature_counts["typescript"] = feature_counts.get("typescript", 0) + 1
        
        # Generate updates based on patterns
        for feature, count in feature_counts.items():
            if count >= 3:  # Pattern appears in multiple projects
                updates.append({
                    "type": "pattern",
                    "feature": feature,
                    "confidence": "high" if count >= 5 else "medium",
                    "recommendation": f"Consider adopting {feature} - found in {count} trending projects",
                })
        
        return updates
    
    def _save_report(self, report: Dict[str, Any]):
        """Save research report to file."""
        date_str = datetime.now().strftime("%Y-%m-%d")
        report_path = self.research_log_path / f"research-{date_str}.json"
        
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Research report saved to {report_path}")
    
    def get_research_history(self, days: int = 7) -> List[Dict[str, Any]]:
        """Get research history for the last N days."""
        reports = []
        
        for i in range(days):
            date = datetime.now() - timedelta(days=i)
            date_str = date.strftime("%Y-%m-%d")
            report_path = self.research_log_path / f"research-{date_str}.json"
            
            if report_path.exists():
                with open(report_path, "r", encoding="utf-8") as f:
                    reports.append(json.load(f))
        
        return reports
    
    def get_absorbed_skills(self) -> List[str]:
        """Get list of skills absorbed from trend research."""
        lessons = self.memory.get_lessons(task_type="trend-research", limit=50)
        
        skills = []
        for lesson in lessons:
            skills.append({
                "skill": lesson.description,
                "source": lesson.task_description,
                "recommendation": lesson.recommendation,
            })
        
        return skills


async def main():
    """Run daily trend research."""
    researcher = TrendResearcher(project_path=".")
    
    print("🔍 Starting Daily Trend Research...")
    print("=" * 60)
    
    # Run research
    report = await researcher.daily_research()
    
    # Print results
    print(f"\n📊 Research Date: {report['date'][:10]}")
    print(f"📦 Projects Discovered: {len(report['projects_discovered'])}")
    
    print("\n🌟 Top Projects:")
    for i, project in enumerate(report["projects_discovered"][:5], 1):
        print(f"{i}. {project['name']} ({project['stars']:,} stars) - {project['language']}")
        if project.get("key_features"):
            print(f"   Features: {project['key_features'][0]}")
    
    print("\n💡 Key Insights:")
    for i, insight in enumerate(report["insights"][:5], 1):
        print(f"{i}. [{insight['source']}] {insight['insight']}")
    
    print("\n📚 Knowledge Updates:")
    for update in report.get("knowledge_updates", [])[:5]:
        print(f"• {update['recommendation']}")
    
    print("\n" + "=" * 60)
    print("✅ Daily Research Complete!")
    
    return report


if __name__ == "__main__":
    asyncio.run(main())
