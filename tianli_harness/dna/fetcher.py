"""DNA Fetcher - Fetches Hero DNA (System Prompt) from GitHub repository with caching."""

import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, Optional
import httpx


@dataclass
class CachedDNA:
    """Cached DNA entry."""
    content: str
    fetched_at: datetime
    ttl: int  # seconds


class DNAFetcher:
    """Fetches Hero DNA (System Prompt) from GitHub repository."""

    def __init__(self, cache_ttl: int = 3600):
        """
        Initialize DNA Fetcher.
        
        Args:
            cache_ttl: Cache time-to-live in seconds (default: 1 hour)
        """
        self.cache_ttl = cache_ttl
        self._cache: Dict[str, CachedDNA] = {}

    async def fetch(
        self,
        hero_id: str,
        repo_owner: str = "agency-agency",
        repo_name: str = "agency-agents",
        github_token: Optional[str] = None
    ) -> str:
        """
        Fetch DNA from GitHub, returns content. Uses cached copy if still valid.
        
        Args:
            hero_id: The hero prompt filename (without .md extension)
            repo_owner: GitHub repository owner
            repo_name: GitHub repository name
            github_token: Optional GitHub token for authentication
            
        Returns:
            The content of the hero prompt
            
        Raises:
            ValueError: If 404 or empty content
            httpx.RequestError: On network errors
        """
        # Check cache first
        cache_key = f"{repo_owner}/{repo_name}/{hero_id}"
        cached = self._cache.get(cache_key)
        if cached:
            if datetime.now() - cached.fetched_at < timedelta(seconds=cached.ttl):
                return cached.content

        # Construct raw URL
        url = f"https://raw.githubusercontent.com/{repo_owner}/{repo_name}/main/{hero_id}.md"

        # Fetch with optional auth
        headers = {}
        if github_token:
            headers["Authorization"] = f"token {github_token}"

        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers)
            
            # Handle 404
            if response.status_code == 404:
                raise ValueError(
                    f"Hero prompt '{hero_id}' not found in {repo_owner}/{repo_name}. "
                    f"Expected URL: {url}"
                )
            
            # Raise on other HTTP errors
            response.raise_for_status()
            
            content = response.text.strip()
            
            # Check for empty content
            if not content:
                raise ValueError(
                    f"Hero prompt '{hero_id}' is empty in {repo_owner}/{repo_name}"
                )

        # Cache the result
        self._cache[cache_key] = CachedDNA(
            content=content,
            fetched_at=datetime.now(),
            ttl=self.cache_ttl
        )

        return content

    def invalidate_cache(self, hero_id: str, repo_owner: str, repo_name: str) -> None:
        """Force invalidate cached entry."""
        cache_key = f"{repo_owner}/{repo_name}/{hero_id}"
        self._cache.pop(cache_key, None)

    def clear_cache(self) -> None:
        """Clear entire cache."""
        self._cache.clear()
