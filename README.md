# 🕷️ MCP Web Scrape

> Clean, cached web content for agents—Markdown + citations, robots-aware, ETag/304 caching.

[![npm version](https://badge.fury.io/js/mcp-web-scrape.svg)](https://badge.fury.io/js/mcp-web-scrape)
[![CI](https://github.com/mukul975/mcp-web-scrape/workflows/CI/badge.svg)](https://github.com/mukul975/mcp-web-scrape/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/mukul975/mcp-web-scrape.svg?style=social&label=Star)](https://github.com/mukul975/mcp-web-scrape)

## 🎬 Demo

<!-- Replace with actual GIF -->
<!-- Demo GIF will be added soon -->
> 🎬 **Demo coming soon!** A comprehensive video demonstration showcasing the MCP Web Scrape server's capabilities will be available here.

*Watch how MCP Web Scrape transforms messy HTML into clean Markdown with citations in seconds*

## ⚡ Quick Start

```bash
# Install globally
npm install -g mcp-web-scrape

# Try it instantly
npx mcp-web-scrape@latest

# Or start HTTP server
node dist/http.js
```

### ChatGPT Desktop Setup

Add to your `~/Library/Application Support/ChatGPT/config.json`:

```json
{
  "mcpServers": {
    "web-scrape": {
      "command": "npx",
      "args": ["mcp-web-scrape@latest"]
    }
  }
}
```

### Claude Desktop Setup

Add to your `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "web-scrape": {
      "command": "npx",
      "args": ["mcp-web-scrape@latest"]
    }
  }
}
```

## 🛠️ Available Tools

| Tool | Description |
|------|-------------|
| `extract_content` | Convert HTML to clean Markdown with citations |
| `summarize_content` | AI-powered content summarization |
| `get_page_metadata` | Extract title, description, author, keywords |
| `extract_links` | Get all links with filtering options |
| `extract_images` | Extract images with alt text and dimensions |
| `search_content` | Search within page content |
| `check_url_status` | Verify URL accessibility |
| `validate_robots` | Check robots.txt compliance |
| `extract_structured_data` | Parse JSON-LD, microdata, RDFa |
| `compare_content` | Compare two pages for changes |
| `batch_extract` | Process multiple URLs efficiently |
| `get_cache_stats` | View cache performance metrics |
| `clear_cache` | Manage cached content |

## 🤔 Why Not Just Use Built-in Browsing?

**Deterministic Results** → Same URL always returns identical content  
**Smart Citations** → Every fact links back to its source  
**Robots Compliant** → Respects robots.txt and rate limits  
**Lightning Fast** → ETag/304 caching + persistent storage  
**Agent-Optimized** → Clean Markdown instead of messy HTML  

## 🔒 Safety First

- ✅ **Respects robots.txt** by default
- ✅ **Rate limiting** prevents server overload
- ✅ **No paywall bypass** - ethical scraping only
- ✅ **User-Agent identification** for transparency

## 🚀 Roadmap

- [x] **Core Web Scraping** - Extract clean content from web pages
- [x] **Markdown Conversion** - Transform HTML to readable Markdown
- [x] **Citation System** - Link extracted content to sources
- [x] **Caching System** - Persistent storage with ETag support
- [x] **Rate Limiting** - Respectful scraping with configurable delays
- [x] **Robots.txt Compliance** - Ethical scraping practices
- [ ] **Playwright Integration** - JavaScript rendering for SPAs
- [ ] **PDF Snapshots** - Archive pages as searchable PDFs
- [ ] **Cache Viewer UI** - Web interface for cache management
- [ ] **Custom Extractors** - Plugin system for specialized content
- [ ] **Batch Processing** - Queue system for large-scale extraction

## 📦 Installation

```bash
npm install -g mcp-web-scrape

# Or use directly
npx mcp-web-scrape@latest
```

## 🔧 Configuration

```bash
# Environment variables
export MCP_WEB_SCRAPE_CACHE_DIR="./cache"
export MCP_WEB_SCRAPE_USER_AGENT="MyBot/1.0"
export MCP_WEB_SCRAPE_RATE_LIMIT="1000"
```

## 🌐 Transports

**STDIO** (default)
```bash
mcp-web-scrape
```

**HTTP/SSE**
```bash
node bin/http.js --port 3000
```

## 📚 Resources

Access cached content as MCP resources:

```
cache://example.com/path → Cached page content
cache://stats → Cache statistics
cache://robots/example.com → Robots.txt status
```

## 🤝 Contributing

We love contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Good First Issues:**
- Add new content extractors
- Improve error handling
- Write more tests
- Enhance documentation

## 📄 License

MIT © [Mahipal](https://github.com/mukul975)

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=mukul975/mcp-web-scrape&type=Date)](https://star-history.com/#mukul975/mcp-web-scrape&Date)

---

*Built with ❤️ for the [Model Context Protocol](https://modelcontextprotocol.io) ecosystem*