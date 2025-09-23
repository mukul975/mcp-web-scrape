#!/usr/bin/env python3
"""
Python Client Example for mcp-web-scrape

This example shows how to interact with the mcp-web-scrape server
from Python applications using HTTP requests.

Requirements:
    pip install requests aiohttp asyncio
"""

import asyncio
import json
import time
from typing import Dict, List, Optional, Any

import aiohttp
import requests


class MCPWebScrapeClient:
    """Synchronous client for mcp-web-scrape server"""
    
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'mcp-web-scrape-python-client/1.0'
        })
    
    def health_check(self) -> Dict[str, Any]:
        """Check if the server is healthy"""
        response = self.session.get(f"{self.base_url}/health")
        response.raise_for_status()
        return response.json()
    
    def list_tools(self) -> List[Dict[str, Any]]:
        """List available tools"""
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/list"
        }
        response = self.session.post(f"{self.base_url}/message", json=payload)
        response.raise_for_status()
        result = response.json()
        return result.get('result', {}).get('tools', [])
    
    def fetch_content(self, url: str, **kwargs) -> Dict[str, Any]:
        """Fetch content from a URL"""
        return self._call_tool('fetch', {'url': url, **kwargs})
    
    def extract_content(self, url: str, format: str = 'text', **kwargs) -> Dict[str, Any]:
        """Extract clean content from a URL"""
        return self._call_tool('extract', {
            'url': url, 
            'format': format, 
            **kwargs
        })
    
    def summarize_content(self, url: str, **kwargs) -> Dict[str, Any]:
        """Summarize content from a URL"""
        return self._call_tool('summarize', {'url': url, **kwargs})
    
    def list_cache(self) -> List[Dict[str, Any]]:
        """List cached resources"""
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "resources/list"
        }
        response = self.session.post(f"{self.base_url}/message", json=payload)
        response.raise_for_status()
        result = response.json()
        return result.get('result', {}).get('resources', [])
    
    def purge_cache(self, pattern: Optional[str] = None) -> Dict[str, Any]:
        """Purge cache entries"""
        args = {}
        if pattern:
            args['pattern'] = pattern
        return self._call_tool('purge', args)
    
    def _call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call a specific tool"""
        payload = {
            "jsonrpc": "2.0",
            "id": int(time.time()),
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            }
        }
        response = self.session.post(f"{self.base_url}/message", json=payload)
        response.raise_for_status()
        result = response.json()
        
        if 'error' in result:
            raise Exception(f"Tool call failed: {result['error']}")
        
        return result.get('result', {})
    
    def close(self):
        """Close the session"""
        self.session.close()


class AsyncMCPWebScrapeClient:
    """Asynchronous client for mcp-web-scrape server"""
    
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url.rstrip('/')
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            headers={
                'Content-Type': 'application/json',
                'User-Agent': 'mcp-web-scrape-python-async-client/1.0'
            }
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def health_check(self) -> Dict[str, Any]:
        """Check if the server is healthy"""
        async with self.session.get(f"{self.base_url}/health") as response:
            response.raise_for_status()
            return await response.json()
    
    async def list_tools(self) -> List[Dict[str, Any]]:
        """List available tools"""
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/list"
        }
        async with self.session.post(f"{self.base_url}/message", json=payload) as response:
            response.raise_for_status()
            result = await response.json()
            return result.get('result', {}).get('tools', [])
    
    async def fetch_content(self, url: str, **kwargs) -> Dict[str, Any]:
        """Fetch content from a URL"""
        return await self._call_tool('fetch', {'url': url, **kwargs})
    
    async def extract_content(self, url: str, format: str = 'text', **kwargs) -> Dict[str, Any]:
        """Extract clean content from a URL"""
        return await self._call_tool('extract', {
            'url': url, 
            'format': format, 
            **kwargs
        })
    
    async def summarize_content(self, url: str, **kwargs) -> Dict[str, Any]:
        """Summarize content from a URL"""
        return await self._call_tool('summarize', {'url': url, **kwargs})
    
    async def list_cache(self) -> List[Dict[str, Any]]:
        """List cached resources"""
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "resources/list"
        }
        async with self.session.post(f"{self.base_url}/message", json=payload) as response:
            response.raise_for_status()
            result = await response.json()
            return result.get('result', {}).get('resources', [])
    
    async def purge_cache(self, pattern: Optional[str] = None) -> Dict[str, Any]:
        """Purge cache entries"""
        args = {}
        if pattern:
            args['pattern'] = pattern
        return await self._call_tool('purge', args)
    
    async def _call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call a specific tool"""
        payload = {
            "jsonrpc": "2.0",
            "id": int(time.time()),
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            }
        }
        async with self.session.post(f"{self.base_url}/message", json=payload) as response:
            response.raise_for_status()
            result = await response.json()
            
            if 'error' in result:
                raise Exception(f"Tool call failed: {result['error']}")
            
            return result.get('result', {})


# Example usage functions
def sync_example():
    """Synchronous usage example"""
    print("=== Synchronous Client Example ===")
    
    client = MCPWebScrapeClient()
    
    try:
        # Health check
        health = client.health_check()
        print(f"Server health: {health}")
        
        # List available tools
        tools = client.list_tools()
        print(f"Available tools: {[tool['name'] for tool in tools]}")
        
        # Fetch content
        print("\nFetching content from example.com...")
        fetch_result = client.fetch_content("https://example.com")
        print(f"Fetch result keys: {list(fetch_result.keys())}")
        
        # Extract clean content
        print("\nExtracting clean content...")
        extract_result = client.extract_content(
            "https://example.com", 
            format="markdown",
            include_links=True
        )
        print(f"Extracted content preview: {extract_result.get('content', [''])[0][:200]}...")
        
        # List cache
        cache = client.list_cache()
        print(f"\nCached resources: {len(cache)} items")
        
        # Summarize content (if available)
        try:
            summary = client.summarize_content("https://example.com")
            print(f"\nSummary: {summary.get('content', [''])[0][:200]}...")
        except Exception as e:
            print(f"\nSummarize not available: {e}")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        client.close()


async def async_example():
    """Asynchronous usage example"""
    print("\n=== Asynchronous Client Example ===")
    
    async with AsyncMCPWebScrapeClient() as client:
        try:
            # Health check
            health = await client.health_check()
            print(f"Server health: {health}")
            
            # Concurrent requests
            urls = [
                "https://example.com",
                "https://httpbin.org/html",
                "https://jsonplaceholder.typicode.com/posts/1"
            ]
            
            print(f"\nFetching {len(urls)} URLs concurrently...")
            tasks = [client.fetch_content(url) for url in urls]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    print(f"URL {i+1} failed: {result}")
                else:
                    print(f"URL {i+1} success: {len(result.get('content', [''])[0])} chars")
            
            # List cache after concurrent requests
            cache = await client.list_cache()
            print(f"\nCached resources after batch: {len(cache)} items")
            
        except Exception as e:
            print(f"Error: {e}")


def batch_processing_example():
    """Example of processing multiple URLs"""
    print("\n=== Batch Processing Example ===")
    
    urls = [
        "https://news.ycombinator.com",
        "https://github.com",
        "https://stackoverflow.com"
    ]
    
    client = MCPWebScrapeClient()
    
    try:
        results = []
        for i, url in enumerate(urls, 1):
            print(f"Processing {i}/{len(urls)}: {url}")
            try:
                # Extract content in markdown format
                result = client.extract_content(
                    url, 
                    format="markdown",
                    include_links=True,
                    include_images=False
                )
                
                content = result.get('content', [''])[0]
                results.append({
                    'url': url,
                    'title': result.get('title', 'Unknown'),
                    'content_length': len(content),
                    'success': True
                })
                
                print(f"  ✓ Success: {len(content)} characters")
                
            except Exception as e:
                print(f"  ✗ Failed: {e}")
                results.append({
                    'url': url,
                    'error': str(e),
                    'success': False
                })
            
            # Small delay to be respectful
            time.sleep(1)
        
        # Summary
        successful = sum(1 for r in results if r['success'])
        print(f"\nBatch complete: {successful}/{len(urls)} successful")
        
        # Show cache status
        cache = client.list_cache()
        print(f"Cache now contains: {len(cache)} items")
        
    finally:
        client.close()


def cache_management_example():
    """Example of cache management"""
    print("\n=== Cache Management Example ===")
    
    client = MCPWebScrapeClient()
    
    try:
        # Check initial cache
        cache = client.list_cache()
        print(f"Initial cache: {len(cache)} items")
        
        # Fetch some content to populate cache
        print("\nPopulating cache...")
        test_urls = [
            "https://example.com",
            "https://httpbin.org/html"
        ]
        
        for url in test_urls:
            try:
                client.fetch_content(url)
                print(f"  ✓ Cached: {url}")
            except Exception as e:
                print(f"  ✗ Failed: {url} - {e}")
        
        # Check cache after population
        cache = client.list_cache()
        print(f"\nCache after population: {len(cache)} items")
        
        # Show cache details
        for item in cache:
            print(f"  - {item.get('uri', 'Unknown')}: {item.get('name', 'No name')}")
        
        # Purge specific items
        print("\nPurging example.com from cache...")
        purge_result = client.purge_cache("example.com")
        print(f"Purge result: {purge_result}")
        
        # Check cache after purge
        cache = client.list_cache()
        print(f"Cache after purge: {len(cache)} items")
        
    finally:
        client.close()


if __name__ == "__main__":
    print("MCP Web Scrape Python Client Examples")
    print("=====================================")
    print("Make sure the mcp-web-scrape server is running on http://localhost:3000")
    print("Start it with: mcp-web-scrape --transport http")
    print()
    
    # Run examples
    try:
        sync_example()
        asyncio.run(async_example())
        batch_processing_example()
        cache_management_example()
        
        print("\n=== All Examples Complete ===")
        
    except KeyboardInterrupt:
        print("\nExamples interrupted by user")
    except Exception as e:
        print(f"\nExample failed: {e}")
        print("Make sure the mcp-web-scrape server is running!")