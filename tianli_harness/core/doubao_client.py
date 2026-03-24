"""
Doubao Client - Anthropic-compatible API client for Volcengine Doubao

This client wraps the Volcengine Doubao API to be compatible with Anthropic's interface.
"""

import httpx
from typing import List, Dict, Any, Optional
from datetime import datetime


class DoubaoClient:
    """Anthropic-compatible client for Volcengine Doubao API"""
    
    def __init__(
        self,
        api_key: str,
        base_url: str = "https://ark.cn-beijing.volces.com/api/coding/v3",
        model: str = "doubao-seed-2.0-code",
        timeout: float = 120.0
    ):
        self.api_key = api_key
        self.base_url = base_url
        self.model = model
        self.timeout = timeout
        self.client = httpx.AsyncClient(timeout=timeout)
    
    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()
    
    async def messages_create(
        self,
        model: Optional[str] = None,
        max_tokens: int = 4096,
        messages: List[Dict[str, str]] = None,
        **kwargs
    ) -> Any:
        """
        Create a message completion (Anthropic-compatible interface)
        
        Args:
            model: Model name (uses default if None)
            max_tokens: Maximum tokens to generate
            messages: List of message dicts with 'role' and 'content'
            **kwargs: Additional parameters
        
        Returns:
            Response object compatible with Anthropic's response format
        """
        model = model or self.model
        
        # Convert Anthropic format to Doubao format
        doubao_messages = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            
            # Handle tool_use format
            if isinstance(content, list):
                # Extract text from content blocks
                text_content = ""
                for block in content:
                    if isinstance(block, dict):
                        if block.get("type") == "text":
                            text_content += block.get("text", "")
                        elif block.get("type") == "tool_use":
                            text_content += f"\n[Tool: {block.get('name', 'unknown')}]\n"
                
                content = text_content
            
            doubao_messages.append({
                "role": role,
                "content": content
            })
        
        # Make API request
        try:
            response = await self.client.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": doubao_messages,
                    "max_tokens": max_tokens,
                    **kwargs
                }
            )
            
            response.raise_for_status()
            data = response.json()
            
            # Convert Doubao response to Anthropic format
            return self._convert_response(data)
            
        except httpx.HTTPError as e:
            # Create error response compatible with Anthropic format
            return self._create_error_response(str(e))
        except Exception as e:
            return self._create_error_response(str(e))
    
    def _convert_response(self, data: Dict[str, Any]) -> Any:
        """Convert Doubao API response to Anthropic format"""
        
        # Create a simple response object
        class Response:
            def __init__(self, data):
                self.data = data
                self.id = data.get("id", "")
                self.model = data.get("model", "")
                self.usage = data.get("usage", {})
                
                # Extract content
                choices = data.get("choices", [])
                self.content = []
                
                if choices and len(choices) > 0:
                    message = choices[0].get("message", {})
                    content_text = message.get("content", "")
                    
                    # Create text block
                    if content_text:
                        self.content.append(TextBlock(text=content_text))
            
            def __repr__(self):
                return f"Response(id={self.id}, model={self.model})"
        
        return Response(data)
    
    def _create_error_response(self, error_message: str) -> Any:
        """Create error response compatible with Anthropic format"""
        
        class ErrorResponse:
            def __init__(self, error):
                self.error = error
                self.content = []
            
            def __repr__(self):
                return f"ErrorResponse(error={self.error})"
        
        return ErrorResponse(error_message)


class TextBlock:
    """Text block compatible with Anthropic's format"""
    
    def __init__(self, text: str):
        self.text = text
        self.type = "text"
    
    def __repr__(self):
        return f"TextBlock(text={self.text[:50]}...)"


# Convenience function
def create_doubao_client(
    api_key: str,
    base_url: str = "https://ark.cn-beijing.volces.com/api/coding",
    model: str = "doubao-seed-2.0-code"
) -> DoubaoClient:
    """
    Create a Doubao client with Anthropic-compatible interface
    
    Usage:
        client = create_doubao_client(api_key="your-key")
        response = await client.messages_create(
            model="doubao-seed-2.0-code",
            max_tokens=4096,
            messages=[{"role": "user", "content": "Hello"}]
        )
    """
    return DoubaoClient(api_key=api_key, base_url=base_url, model=model)
