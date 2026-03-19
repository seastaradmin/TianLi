"""Unit tests for DNA Fetcher."""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, Mock

from tianli_harness.dna.fetcher import DNAFetcher, CachedDNA


class TestDNAFetcher:
    """Tests for DNAFetcher class."""

    def test_init(self):
        """Test initialization."""
        fetcher = DNAFetcher()
        assert fetcher.cache_ttl == 3600
        assert fetcher._cache == {}

        fetcher_custom = DNAFetcher(cache_ttl=1800)
        assert fetcher_custom.cache_ttl == 1800

    @pytest.mark.asyncio
    async def test_fetch_cached(self):
        """Test fetching from cache."""
        fetcher = DNAFetcher()
        
        # Manually add to cache
        cache_key = "test/repo/hero"
        fetcher._cache[cache_key] = CachedDNA(
            content="# Cached Content",
            fetched_at=datetime.now(),
            ttl=3600
        )
        
        # Should return cached content
        result = await fetcher.fetch("hero", "test", "repo")
        assert result == "# Cached Content"

    @pytest.mark.asyncio
    async def test_fetch_cache_expired(self):
        """Test fetching when cache is expired."""
        fetcher = DNAFetcher()
        
        # Add expired cache entry
        cache_key = "test/repo/hero"
        fetcher._cache[cache_key] = CachedDNA(
            content="# Old Content",
            fetched_at=datetime.now() - timedelta(seconds=7200),  # 2 hours ago
            ttl=3600
        )
        
        # Mock the HTTP client
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = "# New Content"
        mock_response.raise_for_status = Mock()
        
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client
            
            result = await fetcher.fetch("hero", "test", "repo")
            
            # Should fetch new content
            assert result == "# New Content"
            # Cache should be updated
            assert fetcher._cache[cache_key].content == "# New Content"

    @pytest.mark.asyncio
    async def test_fetch_network(self):
        """Test fetching from network."""
        fetcher = DNAFetcher()
        
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = "# Test Prompt"
        mock_response.raise_for_status = Mock()
        
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client
            
            result = await fetcher.fetch("test-hero")
            
            assert result == "# Test Prompt"
            # Verify cache was populated
            assert "agency-agency/agency-agents/test-hero" in fetcher._cache

    @pytest.mark.asyncio
    async def test_fetch_404(self):
        """Test handling 404 error."""
        fetcher = DNAFetcher()
        
        mock_response = Mock()
        mock_response.status_code = 404
        
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client
            
            with pytest.raises(ValueError) as excinfo:
                await fetcher.fetch("not-found")
            
            assert "not found" in str(excinfo.value).lower()

    @pytest.mark.asyncio
    async def test_fetch_empty_content(self):
        """Test handling empty content."""
        fetcher = DNAFetcher()
        
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = "   "  # Only whitespace
        mock_response.raise_for_status = Mock()
        
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client
            
            with pytest.raises(ValueError) as excinfo:
                await fetcher.fetch("empty")
            
            assert "empty" in str(excinfo.value).lower()

    def test_invalidate_cache(self):
        """Test cache invalidation."""
        fetcher = DNAFetcher()
        
        # Add to cache
        fetcher._cache["test/repo/hero"] = CachedDNA(
            content="# Content",
            fetched_at=datetime.now(),
            ttl=3600
        )
        
        # Invalidate
        fetcher.invalidate_cache("hero", "test", "repo")
        
        # Should be removed
        assert "test/repo/hero" not in fetcher._cache

    def test_clear_cache(self):
        """Test clearing entire cache."""
        fetcher = DNAFetcher()
        
        # Add multiple entries
        fetcher._cache["key1"] = CachedDNA(content="c1", fetched_at=datetime.now(), ttl=3600)
        fetcher._cache["key2"] = CachedDNA(content="c2", fetched_at=datetime.now(), ttl=3600)
        
        # Clear
        fetcher.clear_cache()
        
        # Should be empty
        assert fetcher._cache == {}


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
