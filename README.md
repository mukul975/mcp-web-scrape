# 🕷️ MCP Web Scrape

> Clean, cached web content for agents—Markdown + citations, robots-aware, ETag/304 caching.

[![npm version](https://img.shields.io/npm/v/mcp-web-scrape.svg)](https://www.npmjs.com/package/mcp-web-scrape)
[![CI](https://github.com/mukul975/mcp-web-scrape/workflows/CI/badge.svg)](https://github.com/mukul975/mcp-web-scrape/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/mukul975/mcp-web-scrape.svg?style=social&label=Star)](https://github.com/mukul975/mcp-web-scrape)

## 📦 Version

**Current Version:** `1.0.7`

## 🎬 Live Demos

See MCP Web Scrape in action! These demos show real-time extraction and processing:

### 📄 Content Extraction
![Extract Content Demo]<img src="demo/extract_content_demo.gif"><br>
*Transform messy HTML into clean, agent-ready Markdown with automatic citations*

### 🔗 Link Extraction  
![Extract Links Demo](https://raw.githubusercontent.com/mukul975/mcp-web-scrape/main/demo/extract_link_demo.gif)
*Extract and categorize all links from any webpage with filtering options*

### 📊 Metadata Extraction
![Metadata Demo](https://raw.githubusercontent.com/mukul975/mcp-web-scrape/main/demo/metadata_demo.gif)
*Get comprehensive page metadata including title, description, author, and keywords*

### 📝 Content Summarization
![Summarize Content Demo](https://raw.githubusercontent.com/mukul975/mcp-web-scrape/main/demo/summarize_content_demo.gif)
*AI-powered content summarization for quick insights and key points*

### 🚀 Quick Start Demo

```bash
# Extract content from any webpage
npx mcp-web-scrape@1.0.7

# Example: Extract from a news article
> extract_content https://news.ycombinator.com
✅ Extracted 1,247 words with 5 citations
📄 Clean Markdown ready for your AI agent
```

## 🎯 Tool Examples

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

# Analyze sentiment of content
> sentiment_analysis https://blog.example.com/article
✅ Sentiment: Positive (0.85), Emotional tone: Optimistic

# Extract named entities
> extract_entities https://news.example.com/article
✅ Found 12 people, 8 organizations, 5 locations

# Check for security vulnerabilities
> scan_vulnerabilities https://mysite.com
✅ No XSS vulnerabilities found, 2 header improvements suggested

# Analyze competitor SEO
> analyze_competitors ["https://competitor1.com", "https://competitor2.com"]
✅ Competitor analysis complete: keyword gaps identified

# Monitor uptime and performance
> monitor_uptime https://mysite.com --interval 300
✅ Uptime: 99.9%, Average response: 245ms

# Generate comprehensive report
> generate_reports https://website.com --metrics ["seo", "performance", "security"]
✅ Generated 15-page analysis report
```

## ⚡ Quick Start

```bash
# Install globally
npm install -g mcp-web-scrape@1.0.7

# Try it instantly (latest version)
npx mcp-web-scrape@latest

# Try specific version
npx mcp-web-scrape@1.0.7

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
      "args": ["mcp-web-scrape@1.0.7"]
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
      "args": ["mcp-web-scrape@1.0.7"]
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

### Content Transformation Tools
| Tool | Description |
|------|-------------|
| `convert_to_pdf` | Convert web pages to PDF format with customizable settings |
| `extract_text_only` | Extract plain text content without formatting or HTML |
| `generate_word_cloud` | Generate word frequency analysis and word cloud data |
| `translate_content` | Translate web page content to different languages |
| `extract_keywords` | Extract important keywords and phrases from content |

### Advanced Analysis Tools
| Tool | Description |
|------|-------------|
| `analyze_readability` | Analyze text readability using various metrics (Flesch, Gunning-Fog, etc.) |
| `detect_language` | Detect the primary language of web page content |
| `extract_entities` | Extract named entities (people, places, organizations) |
| `sentiment_analysis` | Analyze sentiment and emotional tone of content |
| `classify_content` | Classify content into categories and topics |

### SEO & Marketing Tools
| Tool | Description |
|------|-------------|
| `analyze_competitors` | Analyze competitor websites for SEO and content insights |
| `extract_schema_markup` | Extract and validate schema.org structured data |
| `check_broken_links` | Check for broken links and redirects on pages |
| `analyze_page_speed` | Analyze page loading speed and performance metrics |
| `generate_meta_tags` | Generate optimized meta tags for SEO |

### Security & Privacy Tools
| Tool | Description |
|------|-------------|
| `scan_vulnerabilities` | Scan pages for common security vulnerabilities |
| `check_ssl_certificate` | Check SSL certificate validity and security details |
| `analyze_cookies` | Analyze cookies and tracking mechanisms |
| `detect_tracking` | Detect tracking scripts and privacy concerns |
| `check_privacy_policy` | Analyze privacy policy compliance and coverage |

### Advanced Monitoring Tools
| Tool | Description |
|------|-------------|
| `monitor_uptime` | Monitor website uptime and availability |
| `track_changes_detailed` | Advanced change tracking with similarity analysis |
| `analyze_traffic_patterns` | Analyze website traffic patterns and trends |
| `benchmark_performance` | Benchmark performance against competitors |
| `generate_reports` | Generate comprehensive analysis reports |

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


## 📦 Installation

```bash
# Install specific version
npm install -g mcp-web-scrape@1.0.7

# Or use directly (latest)
npx mcp-web-scrape@latest

# Or use specific version
npx mcp-web-scrape@1.0.7
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
