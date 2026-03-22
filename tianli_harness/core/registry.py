"""Hero registry loading and remote import support."""

from __future__ import annotations

import json
import math
import re
from dataclasses import asdict
from hashlib import sha1
from html import unescape
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx

from tianli_harness.core.state import (
    HarnessConfig,
    HeroCapability,
    HeroProfile,
    RemoteHeroSource,
)
from tianli_harness.dna.fetcher import DNAFetcher


DEFAULT_REGISTRY_PATH = Path(__file__).resolve().parent.parent / "data" / "heroes.json"
DEFAULT_REMOTE_CACHE_PATH = Path(__file__).resolve().parent.parent / "data" / "heroes.remote-cache.json"
DEFAULT_AGENCY_CATEGORIES = ["design", "engineering", "product", "marketing", "project-management"]
DEFAULT_SKILLS_PAGES = ["", "trending", "hot"]
SKILLS_BASE_URL = "https://skills.sh"
FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n?", re.S)
H1_RE = re.compile(r"<h1[^>]*>(.*?)</h1>", re.I | re.S)
H2_RE = re.compile(r"<h2[^>]*>(.*?)</h2>", re.I | re.S)
SKILL_ROUTE_RE = re.compile(r'href=["\'](/[^/"\']+/[^/"\']+/[^/"\']+)["\']')
HTML_TAG_RE = re.compile(r"<[^>]+>")
TOKEN_RE = re.compile(r"[a-z0-9]+")

CATEGORY_ZH = {
    "design": "设计",
    "engineering": "工程",
    "product": "产品",
    "marketing": "市场",
    "project-management": "项目",
    "sales": "销售",
    "integrations": "集成",
    "specialized": "专项",
}

CATEGORY_COLORS = {
    "design": "#c084fc",
    "engineering": "#60a5fa",
    "product": "#f59e0b",
    "marketing": "#fb7185",
    "project-management": "#2dd4bf",
    "sales": "#f97316",
    "integrations": "#22c55e",
    "specialized": "#a78bfa",
}

CATEGORY_TOOLS = {
    "design": ["Read", "Write", "Edit", "Glob", "Grep"],
    "engineering": ["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
    "product": ["Read", "Write", "Glob", "Grep"],
    "marketing": ["Read", "Write", "Glob", "Grep"],
    "project-management": ["Read", "Write", "Glob", "Grep"],
}

CATEGORY_SKILL_HINTS = {
    "design": ["ui-design-review", "web-design-guidelines", "browser-devtools-cli"],
    "engineering": ["browser-devtools-cli", "tianli-harness", "find-skills"],
    "product": ["product-strategy-session", "startup-analyst", "pricing-strategy"],
    "marketing": ["pricing-strategy", "startup-analyst"],
    "project-management": ["product-strategy-session", "tianli-harness"],
}

TOKEN_TRANSLATIONS = {
    "ui": "界面",
    "ux": "体验",
    "design": "设计",
    "designer": "设计师",
    "visual": "视觉",
    "visuals": "视觉",
    "brand": "品牌",
    "guardian": "守护者",
    "inclusive": "包容",
    "image": "图像",
    "prompt": "提示",
    "engineer": "工程师",
    "architect": "架构师",
    "researcher": "研究员",
    "specialist": "专精者",
    "storyteller": "叙事师",
    "whimsy": "灵感",
    "injector": "注入者",
    "ai": "智能",
    "data": "数据",
    "remediation": "修复",
    "autonomous": "自治",
    "optimization": "优化",
    "backend": "后端",
    "frontend": "前端",
    "code": "代码",
    "reviewer": "审查官",
    "database": "数据库",
    "optimizer": "优化师",
    "devops": "运维",
    "automator": "自动化师",
    "embedded": "嵌入式",
    "firmware": "固件",
    "feishu": "飞书",
    "integration": "集成",
    "developer": "开发者",
    "git": "Git",
    "workflow": "流程",
    "master": "大师",
    "incident": "事故",
    "response": "响应",
    "commander": "指挥官",
    "mobile": "移动",
    "app": "应用",
    "builder": "构建者",
    "rapid": "快速",
    "prototyper": "原型师",
    "security": "安全",
    "senior": "资深",
    "software": "软件",
    "sre": "稳定性",
    "manager": "经理",
    "feedback": "反馈",
    "synthesizer": "综合师",
    "sprint": "冲刺",
    "prioritizer": "优先级官",
    "trend": "趋势",
    "behavioral": "行为",
    "nudge": "引导",
    "engine": "引擎",
    "content": "内容",
    "cloudflare": "云边界",
    "web": "网页",
    "perf": "性能",
    "testing": "测试",
    "testing": "测试",
    "theme": "主题",
    "factory": "工坊",
    "frontenddesign": "前端设计",
}


def _clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def _slug_words(value: str) -> List[str]:
    return TOKEN_RE.findall(value.lower())


def _humanize_slug(value: str) -> str:
    words = _slug_words(value)
    if not words:
        return value.strip() or "Unknown Hero"
    return " ".join(word.upper() if len(word) <= 3 else word.capitalize() for word in words)


def _extract_frontmatter(text: str) -> Dict[str, str]:
    match = FRONTMATTER_RE.match(text)
    if not match:
        return {}

    parsed: Dict[str, str] = {}
    for line in match.group(1).splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        parsed[key.strip()] = value.strip().strip("'\"")
    return parsed


def _extract_html_text(pattern: re.Pattern[str], html: str) -> str:
    match = pattern.search(html)
    if not match:
        return ""
    return unescape(HTML_TAG_RE.sub("", match.group(1))).strip()


def _translate_tokens(value: str) -> str:
    words = _slug_words(value)
    if not words:
        return value.strip() or "未命名星使"
    translated = [TOKEN_TRANSLATIONS.get(word, word.upper() if len(word) <= 3 else word.capitalize()) for word in words]
    return " ".join(translated[:4])


def _color_from_seed(seed: str) -> str:
    palette = [
        "#7dd3fc",
        "#f59e0b",
        "#34d399",
        "#fda4af",
        "#c084fc",
        "#60a5fa",
        "#2dd4bf",
        "#fb7185",
        "#facc15",
        "#a78bfa",
    ]
    digest = sha1(seed.encode("utf-8")).digest()
    return palette[digest[0] % len(palette)]


def _star_position(index: int, group_index: int, group_total: int, spread_seed: str) -> Dict[str, float]:
    total = max(group_total, 1)
    anchor_angle = (-math.pi / 2) + ((2 * math.pi) * group_index / total)
    anchor_x = 0.5 + math.cos(anchor_angle) * 0.27
    anchor_y = 0.46 + math.sin(anchor_angle) * 0.2
    digest = sha1(f"{spread_seed}-{index}".encode("utf-8")).digest()
    local_angle = ((digest[0] / 255) * 2 * math.pi) + (index * 0.63)
    radius = 0.05 + ((digest[1] / 255) * 0.12)
    return {
        "x": round(_clamp(anchor_x + math.cos(local_angle) * radius, 0.08, 0.92), 4),
        "y": round(_clamp(anchor_y + math.sin(local_angle) * radius, 0.1, 0.88), 4),
    }


def _unique(items: List[str]) -> List[str]:
    seen = set()
    ordered: List[str] = []
    for item in items:
        if not item or item in seen:
            continue
        ordered.append(item)
        seen.add(item)
    return ordered


class HeroRegistry:
    """Loads local heroes and optionally refreshes remote metadata into a local cache."""

    def __init__(self, config: HarnessConfig, fetcher: Optional[DNAFetcher] = None):
        self.config = config
        self.fetcher = fetcher or DNAFetcher()
        self.registry_path = Path(config.hero_registry_path or DEFAULT_REGISTRY_PATH)
        self.remote_cache_path = DEFAULT_REMOTE_CACHE_PATH

    async def list_profiles(self, refresh_remote: bool = False) -> List[HeroProfile]:
        """Return merged hero profiles, preferring local registry values."""
        local_doc = self._load_document(self.registry_path)
        local_profiles = self._parse_profiles(local_doc.get("heroes", []))
        remote_profiles = self._parse_profiles(self._load_document(self.remote_cache_path).get("heroes", []))

        if refresh_remote:
            refreshed, _errors = await self.refresh_remote_sources(local_doc)
            remote_profiles = refreshed

        return self._merge_profiles(local_profiles, remote_profiles)

    async def refresh_remote_sources(self, local_doc: Optional[Dict[str, Any]] = None) -> Tuple[List[HeroProfile], List[str]]:
        """Refresh remote sources into the local cache file."""
        local_doc = local_doc or self._load_document(self.registry_path)
        cached_profiles = self._parse_profiles(self._load_document(self.remote_cache_path).get("heroes", []))
        source_dicts = local_doc.get("remote_sources", [])
        configured_sources = list(self.config.remote_sources)
        file_sources = [self._source_from_dict(item) for item in source_dicts]
        remote_sources = configured_sources or file_sources

        imported: List[HeroProfile] = []
        errors: List[str] = []

        for source in remote_sources:
            if not source.enabled:
                continue
            try:
                imported.extend(await self._refresh_source(source))
            except Exception as exc:  # pragma: no cover - defensive logging path
                errors.append(f"{source.source_id}: {exc}")
                imported.extend([profile for profile in cached_profiles if profile.source == source.source_id])

        serialized = {"heroes": [self._hero_to_dict(profile) for profile in imported]}
        self.remote_cache_path.write_text(
            json.dumps(serialized, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return imported, errors

    def _load_document(self, path: Path) -> Dict[str, Any]:
        if not path.exists():
            return {"heroes": [], "remote_sources": []}
        return json.loads(path.read_text(encoding="utf-8"))

    def _parse_profiles(self, raw_profiles: List[Dict[str, Any]]) -> List[HeroProfile]:
        profiles: List[HeroProfile] = []
        for item in raw_profiles:
            capabilities = [
                HeroCapability(name=cap["name"], weight=float(cap.get("weight", 1.0)))
                for cap in item.get("capabilities", [])
            ]
            profiles.append(
                HeroProfile(
                    hero_id=item["hero_id"],
                    display_name=item.get("display_name", item["hero_id"]),
                    description=item.get("description", ""),
                    display_name_zh=item.get("display_name_zh", ""),
                    display_name_en=item.get("display_name_en", ""),
                    description_zh=item.get("description_zh", ""),
                    description_en=item.get("description_en", ""),
                    tags=list(item.get("tags", [])),
                    task_types=list(item.get("task_types", [])),
                    tools=list(item.get("tools", [])),
                    linked_skills=list(item.get("linked_skills", [])),
                    capabilities=capabilities,
                    star_position=dict(item.get("star_position", {"x": 0.5, "y": 0.5})),
                    routing_priority=float(item.get("routing_priority", 0.5)),
                    fallback_heroes=list(item.get("fallback_heroes", [])),
                    max_parallel_tasks=int(item.get("max_parallel_tasks", 1)),
                    enabled=bool(item.get("enabled", True)),
                    system_prompt=item.get("system_prompt", ""),
                    color=item.get("color", "#7dd3fc"),
                    source=item.get("source", "local"),
                )
            )
        return profiles

    def _merge_profiles(self, local_profiles: List[HeroProfile], remote_profiles: List[HeroProfile]) -> List[HeroProfile]:
        merged: Dict[str, HeroProfile] = {profile.hero_id: profile for profile in remote_profiles}

        for local in local_profiles:
            remote = merged.get(local.hero_id)
            if not remote:
                merged[local.hero_id] = local
                continue
            merged[local.hero_id] = HeroProfile(
                hero_id=local.hero_id,
                display_name=local.display_name or remote.display_name,
                description=local.description or remote.description,
                display_name_zh=local.display_name_zh or remote.display_name_zh,
                display_name_en=local.display_name_en or remote.display_name_en,
                description_zh=local.description_zh or remote.description_zh,
                description_en=local.description_en or remote.description_en,
                tags=self._merge_lists(local.tags, remote.tags),
                task_types=self._merge_lists(local.task_types, remote.task_types),
                tools=self._merge_lists(local.tools, remote.tools),
                linked_skills=self._merge_lists(local.linked_skills, remote.linked_skills),
                capabilities=local.capabilities or remote.capabilities,
                star_position=local.star_position or remote.star_position,
                routing_priority=local.routing_priority if local.routing_priority else remote.routing_priority,
                fallback_heroes=self._merge_lists(local.fallback_heroes, remote.fallback_heroes),
                max_parallel_tasks=local.max_parallel_tasks or remote.max_parallel_tasks,
                enabled=local.enabled,
                system_prompt=local.system_prompt or remote.system_prompt,
                color=local.color or remote.color,
                source=local.source,
            )

        return sorted(merged.values(), key=lambda profile: profile.routing_priority, reverse=True)

    async def _refresh_source(self, source: RemoteHeroSource) -> List[HeroProfile]:
        if source.kind == "github_dna":
            return await self._refresh_github_source(source)
        if source.kind in {"generic_json", "skills_json"}:
            return await self._refresh_json_source(source)
        if source.kind == "agency_agents":
            return await self._refresh_agency_agents_source(source)
        if source.kind == "skills_directory":
            return await self._refresh_skills_directory_source(source)
        raise ValueError(f"Unsupported remote source kind: {source.kind}")

    async def _refresh_github_source(self, source: RemoteHeroSource) -> List[HeroProfile]:
        profiles: List[HeroProfile] = []
        for hero_id in source.hero_ids:
            prompt = await self.fetcher.fetch(
                hero_id=hero_id,
                repo_owner=source.owner or self.config.repo_owner,
                repo_name=source.repo or self.config.repo_name,
                github_token=self.config.github_token,
            )
            slug = hero_id.split("/")[-1]
            tags = [part for part in hero_id.replace("/", "-").split("-") if part]
            display_name_en = slug.replace("_", " ").replace("-", " ").title()
            profiles.append(
                HeroProfile(
                    hero_id=hero_id,
                    display_name=display_name_en,
                    display_name_en=display_name_en,
                    display_name_zh=f"远程星使 · {_translate_tokens(slug)}",
                    description=f"Imported from GitHub DNA: {hero_id}",
                    description_en=f"Imported from GitHub DNA: {hero_id}",
                    description_zh=f"从 GitHub DNA 导入的远程星使：{hero_id}",
                    tags=tags,
                    task_types=tags[:2],
                    tools=list(self.config.superpowers),
                    linked_skills=[],
                    capabilities=[HeroCapability(name=tag, weight=1.0) for tag in tags[:3]],
                    system_prompt=prompt,
                    source=source.source_id,
                    star_position=_star_position(len(profiles), 0, 1, hero_id),
                    color=_color_from_seed(hero_id),
                )
            )
        return profiles

    async def _refresh_json_source(self, source: RemoteHeroSource) -> List[HeroProfile]:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            response = await client.get(source.url)
            response.raise_for_status()
            payload = response.json()

        if isinstance(payload, dict):
            payload = payload.get("heroes", payload.get("items", []))
        if not isinstance(payload, list):
            raise ValueError("Remote JSON payload must be a list or contain a 'heroes' list")

        profiles = self._parse_profiles(payload)
        for index, profile in enumerate(profiles):
            profile.source = source.source_id
            if not profile.display_name_en:
                profile.display_name_en = profile.display_name
            if not profile.description_en:
                profile.description_en = profile.description
            if not profile.display_name_zh:
                profile.display_name_zh = profile.display_name
            if not profile.description_zh:
                profile.description_zh = profile.description
            if profile.star_position == {"x": 0.5, "y": 0.5}:
                profile.star_position = _star_position(index, 0, 1, profile.hero_id)
        return profiles

    async def _refresh_agency_agents_source(self, source: RemoteHeroSource) -> List[HeroProfile]:
        categories = source.categories or DEFAULT_AGENCY_CATEGORIES
        limit = source.limit or 28
        profiles: List[HeroProfile] = []
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            for group_index, category in enumerate(categories):
                if len(profiles) >= limit:
                    break
                url = f"https://github.com/{source.owner}/{source.repo}/tree/main/{category}"
                response = await client.get(url)
                response.raise_for_status()
                route_pattern = re.compile(
                    rf'href=["\']/{re.escape(source.owner)}/{re.escape(source.repo)}/blob/main/([^"\']+\.md)["\']'
                )
                file_paths = []
                for relative_path in route_pattern.findall(response.text):
                    if not relative_path.startswith(f"{category}/"):
                        continue
                    if relative_path not in file_paths:
                        file_paths.append(relative_path)

                for relative_path in file_paths:
                    if len(profiles) >= limit:
                        break

                    slug = Path(relative_path).stem
                    normalized_slug = slug[len(category) + 1 :] if slug.startswith(f"{category}-") else slug
                    raw_url = f"https://raw.githubusercontent.com/{source.owner}/{source.repo}/main/{relative_path}"
                    raw_response = await client.get(raw_url)
                    raw_response.raise_for_status()
                    markdown = raw_response.text
                    frontmatter = _extract_frontmatter(markdown)

                    display_name_en = frontmatter.get("name") or _humanize_slug(normalized_slug)
                    display_name_zh = f"{CATEGORY_ZH.get(category, '领域')} · {_translate_tokens(normalized_slug)}"
                    description_en = frontmatter.get("description") or f"Imported from agency-agents: {category}/{slug}"
                    description_zh = f"来自 agency-agents 的 {CATEGORY_ZH.get(category, '远程')}角色型 Hero，擅长 {CATEGORY_ZH.get(category, category)}任务。"
                    tags = _unique([category, *(_slug_words(normalized_slug))])[:8]
                    linked_skills = self._suggest_linked_skills(category, tags)

                    profiles.append(
                        HeroProfile(
                            hero_id=f"agency/{category}/{normalized_slug}",
                            display_name=display_name_en,
                            display_name_en=display_name_en,
                            display_name_zh=display_name_zh,
                            description=description_en,
                            description_en=description_en,
                            description_zh=description_zh,
                            tags=tags,
                            task_types=tags[:3],
                            tools=CATEGORY_TOOLS.get(category, list(self.config.superpowers)),
                            linked_skills=linked_skills,
                            capabilities=[HeroCapability(name=tag, weight=1.0) for tag in tags[:3]],
                            star_position=_star_position(len(profiles), group_index, len(categories), slug),
                            routing_priority=max(0.42, 0.72 - (len(profiles) * 0.007)),
                            max_parallel_tasks=2 if category in {"engineering", "design"} else 1,
                            enabled=True,
                            system_prompt=markdown[:4000] if markdown else description_en,
                            color=CATEGORY_COLORS.get(category, _color_from_seed(slug)),
                            source=source.source_id,
                        )
                    )

        return profiles

    async def _refresh_skills_directory_source(self, source: RemoteHeroSource) -> List[HeroProfile]:
        pages = source.pages or DEFAULT_SKILLS_PAGES
        limit = source.limit or 150
        profiles: List[HeroProfile] = []
        collected_routes: List[str] = []

        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            for page in pages:
                page_path = page.strip("/")
                page_url = source.url.rstrip("/")
                if page_path:
                    page_url = f"{page_url}/{page_path}"
                response = await client.get(page_url)
                response.raise_for_status()
                routes = [route for route in SKILL_ROUTE_RE.findall(response.text) if route not in collected_routes]
                collected_routes.extend(routes)

            candidate_routes = []
            for route in collected_routes:
                if route.startswith("/agents/") or route in {"/docs", "/hot", "/trending", "/official", "/audits"}:
                    continue
                if route.count("/") != 3:
                    continue
                candidate_routes.append(route)

            detail_budget = min(12, len(candidate_routes), limit)
            for index, route in enumerate(candidate_routes[:limit]):
                owner, repo, skill_slug = route.strip("/").split("/", 2)
                title = _humanize_slug(skill_slug)
                subtitle = f"Specialist imported from skills.sh: {owner}/{repo}/{skill_slug}"
                if index < detail_budget:
                    try:
                        page_response = await client.get(f"{source.url.rstrip('/')}{route}")
                        page_response.raise_for_status()
                        html = page_response.text
                        title = _extract_html_text(H1_RE, html) or title
                        subtitle = _extract_html_text(H2_RE, html) or subtitle
                    except Exception:
                        pass
                display_name_zh = f"技能使 · {_translate_tokens(skill_slug)}"
                description_zh = f"来自 skills.sh 的技能型 Hero，专注于 {display_name_zh.replace('技能使 · ', '')}。"
                tags = _unique([owner, repo, *(_slug_words(skill_slug))])[:8]
                linked_skills = _unique([skill_slug, title.lower().replace(" ", "-")])
                profiles.append(
                    HeroProfile(
                        hero_id=f"skill/{owner}/{repo}/{skill_slug}",
                        display_name=title,
                        display_name_en=title,
                        display_name_zh=display_name_zh,
                        description=subtitle,
                        description_en=subtitle,
                        description_zh=description_zh,
                        tags=tags,
                        task_types=tags[:3],
                        tools=["Read", "Write", "Edit", "Glob", "Grep"],
                        linked_skills=linked_skills,
                        capabilities=[HeroCapability(name=tag, weight=0.9) for tag in tags[:3]],
                        star_position=_star_position(index, index % max(len(pages), 2), max(len(pages), 2), route),
                        routing_priority=max(0.32, 0.56 - (index * 0.01)),
                        max_parallel_tasks=1,
                        enabled=True,
                        system_prompt=subtitle,
                        color=_color_from_seed(route),
                        source=source.source_id,
                    )
                )

        return profiles

    def _suggest_linked_skills(self, category: str, tags: List[str]) -> List[str]:
        linked = list(CATEGORY_SKILL_HINTS.get(category, []))
        if "frontend" in tags or "ui" in tags or "ux" in tags:
            linked.extend(["ui-design-review", "web-design-guidelines", "browser-devtools-cli"])
        if "research" in tags or "analysis" in tags:
            linked.extend(["startup-analyst", "find-skills"])
        if "product" in tags or "manager" in tags:
            linked.extend(["product-strategy-session"])
        return _unique(linked)[:4]

    def _source_from_dict(self, raw: Dict[str, Any]) -> RemoteHeroSource:
        return RemoteHeroSource(
            source_id=raw["source_id"],
            kind=raw["kind"],
            url=raw.get("url", ""),
            owner=raw.get("owner", ""),
            repo=raw.get("repo", ""),
            hero_ids=list(raw.get("hero_ids", [])),
            categories=list(raw.get("categories", [])),
            pages=list(raw.get("pages", [])),
            limit=int(raw.get("limit", 0) or 0),
            enabled=bool(raw.get("enabled", True)),
        )

    def _hero_to_dict(self, profile: HeroProfile) -> Dict[str, Any]:
        data = asdict(profile)
        data["capabilities"] = [asdict(capability) for capability in profile.capabilities]
        return data

    def _merge_lists(self, left: List[str], right: List[str]) -> List[str]:
        return _unique(left + right)
