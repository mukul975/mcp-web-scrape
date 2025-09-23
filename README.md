# 🕷️ MCP Web Scrape

> Clean, cached web content for agents—Markdown + citations, robots-aware, ETag/304 caching.

[![npm version](https://img.shields.io/npm/v/mcp-web-scrape.svg)](https://www.npmjs.com/package/mcp-web-scrape)
[![CI](https://github.com/mukul975/mcp-web-scrape/workflows/CI/badge.svg)](https://github.com/mukul975/mcp-web-scrape/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/mukul975/mcp-web-scrape.svg?style=social&label=Star)](https://github.com/mukul975/mcp-web-scrape)

## 📦 Version

**Current Version:** `1.0.1`

## 🎬 Demo

```bash
# Extract content from any webpage
npx mcp-web-scrape@1.0.1

# Example: Extract from a news article
> extract_content https://news.ycombinator.com
✅ Extracted 1,247 words with 5 citations
📄 Clean Markdown ready for your AI agent
```

*Transform messy HTML into clean, agent-ready Markdown with automatic citations*

## 🎯 New Tool Examples

```bash
# Extract all forms from a webpage
> extract_forms https://example.com/contact
✅ Found 3 forms with 12 input fields

# Parse tables into structured data
> extract_tables https://example.com/data --format json
✅ Extracted 5 tables with 247 rows

# Find social media profiles
> extract_social_media https://company.com
✅ Found Twitter, LinkedIn, Facebook profiles

# Monitor page changes
> monitor_changes https://news.site.com --interval 3600
✅ Tracking changes every hour

# Analyze page performance
> analyze_performance https://mysite.com
✅ Load time: 2.3s, SEO score: 85/100

# Generate sitemap
> generate_sitemap https://website.com --max-depth 3
✅ Generated sitemap with 156 pages
```

## ⚡ Quick Start

```bash
# Install globally
npm install -g mcp-web-scrape@1.0.1

# Try it instantly (latest version)
npx mcp-web-scrape@latest

# Try specific version
npx mcp-web-scrape@1.0.1

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
      "args": ["mcp-web-scrape@1.0.1"]
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
      "args": ["mcp-web-scrape@1.0.1"]
    }
  }
}
```

## 🛠️ Available Tools

### Core Extraction Tools
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

### Advanced Extraction Tools
| Tool | Description |
|------|-------------|
| `extract_forms` | Extract form elements, fields, and validation rules |
| `extract_tables` | Parse HTML tables with headers and structured data |
| `extract_social_media` | Find social media links and profiles |
| `extract_contact_info` | Discover emails, phone numbers, and addresses |
| `extract_headings` | Analyze heading structure (H1-H6) for content hierarchy |
| `extract_feeds` | Discover and parse RSS/Atom feeds |

### Analysis & Monitoring Tools
| Tool | Description |
|------|-------------|
| `monitor_changes` | Track content changes over time with similarity analysis |
| `analyze_performance` | Measure page performance, SEO, and accessibility metrics |
| `generate_sitemap` | Crawl websites to generate comprehensive sitemaps |
| `validate_html` | Validate HTML structure, accessibility, and SEO compliance |

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
- [x] **Advanced Extractors** - Forms, tables, social media, contact info
- [x] **Content Analysis** - Headings, feeds, performance metrics
- [x] **Site Monitoring** - Change detection and sitemap generation
- [x] **HTML Validation** - Structure, accessibility, and SEO compliance
- [ ] **Playwright Integration** - JavaScript rendering for SPAs
- [ ] **PDF Snapshots** - Archive pages as searchable PDFs
- [ ] **Cache Viewer UI** - Web interface for cache management
- [ ] **Custom Extractors** - Plugin system for specialized content
- [ ] **Batch Processing** - Queue system for large-scale extraction

## 📦 Installation

```bash
# Install specific version
npm install -g mcp-web-scrape@1.0.1

# Or use directly (latest)
npx mcp-web-scrape@latest

# Or use specific version
npx mcp-web-scrape@1.0.1
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
node dist/http.js --port 3000
```

## 📚 Resources

Access cached content as MCP resources:

```
cache://news.ycombinator.com/path → Cached page content
cache://stats → Cache statistics
cache://robots/news.ycombinator.com → Robots.txt status
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