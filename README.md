# mcp-web-scrape

**Clean, cached web content for agents—Markdown + citations.**

A reliable MCP (Model Context Protocol) server that fetches web pages, extracts clean content, and returns well-formatted Markdown with proper citations. Built for LLM applications that need consistent, cacheable web content without the overhead of full browser automation.

## ✨ Features

- **Clean Content Extraction**: Converts messy HTML into readable Markdown with titles, headings, lists, links, and code blocks
- **Smart Caching**: Uses `ETag` and `Last-Modified` headers for efficient conditional requests
- **Respectful Fetching**: Honors `robots.txt` by default with optional bypass for advanced users
- **Rate Limiting**: Built-in per-host rate limiting to avoid overwhelming servers
- **Multiple Transports**: Works locally via STDIO and remotely via HTTP/SSE
- **First-Class Citations**: Every result includes clear source attribution
- **Cache Management**: List, inspect, and purge cached content
- **Content Summarization**: Optional tool to generate quick summaries

## 🚀 Quick Start

### Local STDIO Mode (for Claude Desktop, etc.)

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start STDIO server
npm run start:stdio
```

### Remote HTTP Mode (for web applications)

```bash
# Start HTTP server with SSE support
npm run start:http

# Server will be available at http://localhost:3000
# MCP endpoint: http://localhost:3000/sse
```

## 📋 Configuration

Configure the server using environment variables:

```bash
# Server settings
MCP_HTTP_PORT=3000
MCP_HTTP_HOST=localhost

# Fetching behavior
MCP_USER_AGENT="mcp-web-scrape/1.0"
MCP_TIMEOUT=30000
MCP_MAX_SIZE=5242880

# Rate limiting
MCP_MAX_REQUESTS_PER_MINUTE=30

# Cache settings
MCP_CACHE_TTL=3600000
MCP_MAX_CACHE_ENTRIES=1000

# Robots.txt
MCP_RESPECT_ROBOTS=true
MCP_ROBOTS_TIMEOUT=5000

# Security
MCP_ALLOWED_HOSTS="*"
MCP_BLOCKED_HOSTS=""
```

## 🔧 Client Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "web-scrape": {
      "command": "node",
      "args": ["/path/to/mcp-web-scrape/dist/stdio.js"],
      "env": {
        "MCP_RESPECT_ROBOTS": "true",
        "MCP_MAX_SIZE": "5242880"
      }
    }
  }
}
```

### ChatGPT Desktop (HTTP Mode)

```json
{
  "mcpServers": {
    "web-scrape": {
      "url": "http://localhost:3000/sse",
      "apiKey": "optional-api-key"
    }
  }
}
```

### Generic MCP Client

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const transport = new SSEClientTransport('http://localhost:3000/sse');
const client = new Client({
  name: 'my-app',
  version: '1.0.0'
}, {
  capabilities: {}
});

await client.connect(transport);
```

## 🛠️ Available Tools

### `extract_content`

Extract and clean content from a web page.

**Parameters:**
- `url` (required): The URL to fetch
- `format`: Output format (`markdown`, `text`, `json`)
- `includeImages`: Include images in output (default: `true`)
- `includeLinks`: Include links in output (default: `true`)
- `bypassRobots`: Bypass robots.txt restrictions (default: `false`)
- `useCache`: Use cached content if available (default: `true`)

**Example:**
```json
{
  "name": "extract_content",
  "arguments": {
    "url": "https://example.com/article",
    "format": "markdown",
    "includeImages": true
  }
}
```

### `summarize_content`

Generate a summary of extracted content.

**Parameters:**
- `content` (required): The content to summarize
- `maxLength`: Maximum summary length (default: `500`)
- `format`: Summary format (`paragraph`, `bullets`)

### `clear_cache`

Clear cached content entries.

**Parameters:**
- `url`: Specific URL to clear (optional, clears all if not provided)

## 📚 Resources

The server exposes cached content as MCP resources:

- **URI Pattern**: `cache://[encoded-url]`
- **Content**: Cached page content with citation
- **Metadata**: Title, fetch timestamp, cache headers

List all cached resources or read specific entries through your MCP client.

## 🤔 Why not just use built-in browsing?

### Consistent Output
- **Standardized Format**: Always returns clean Markdown with consistent structure
- **Reliable Citations**: Every response includes source URL, title, author, and fetch date
- **No UI Noise**: Strips ads, navigation, and other non-content elements

### Performance Benefits
- **Smart Caching**: Conditional requests mean repeat fetches are nearly instant
- **Efficient Storage**: Only stores cleaned content, not full page assets
- **Rate Limiting**: Prevents overwhelming target servers

### Respectful Behavior
- **Robots.txt Awareness**: Honors site preferences by default
- **Proper User-Agent**: Identifies itself clearly to web servers
- **Graceful Errors**: Handles timeouts, redirects, and errors cleanly

### Developer Experience
- **Multiple Transports**: Works with any MCP client via STDIO or HTTP
- **Rich Metadata**: Provides word counts, timestamps, and cache status
- **Debugging Tools**: Cache inspection and management capabilities

## 🔒 Safety & Behavior

### Default Guardrails

- **Robots.txt Compliance**: Checks and respects robots.txt by default
- **Rate Limiting**: Maximum 30 requests per minute per host
- **Size Limits**: Downloads limited to 5MB by default
- **Timeout Protection**: 30-second timeout prevents hanging requests
- **Content Sanitization**: Removes scripts, styles, and potentially harmful content

### What This Server Does NOT Do

- **No Paywall Bypass**: Respects authentication and subscription barriers
- **No JavaScript Rendering**: Processes static HTML only (roadmap item)
- **No Login Handling**: Cannot access authenticated content
- **No PDF Processing**: HTML pages only (roadmap item)

### Cache Management

```bash
# View cache statistics
curl http://localhost:3000/info

# Clear specific URL from cache
# Use the clear_cache tool via your MCP client

# Clear all cache entries
# Use clear_cache tool without URL parameter
```

### Bypassing Robots.txt

For advanced users who need to bypass robots.txt restrictions:

```bash
# Set environment variable
MCP_RESPECT_ROBOTS=false

# Or use the bypassRobots parameter in extract_content tool
```

**Use responsibly**: Only bypass robots.txt when you have permission or legitimate need.

## 🧪 Development

### Scripts

```bash
npm run build          # Compile TypeScript
npm run dev            # Development mode with auto-reload
npm run start:stdio    # Start STDIO server
npm run start:http     # Start HTTP server
npm test              # Run test suite
npm run clean         # Clean build artifacts
```

### Project Structure

```
src/
├── config.ts          # Configuration management
├── cache.ts           # Content caching with conditional requests
├── robots.ts          # Robots.txt checking and parsing
├── fetch.ts           # HTTP fetching with rate limiting
├── extract.ts         # Content extraction and Markdown conversion
├── server.ts          # MCP server implementation
├── stdio.ts           # STDIO transport launcher
└── http.ts            # HTTP/SSE transport launcher
```

### Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- --testNamePattern="robots"
npm test -- --testNamePattern="cache"
npm test -- --testNamePattern="extract"
```

## 🗺️ Roadmap

### Near Term
- [ ] **JavaScript Rendering**: Optional headless browser support for SPAs
- [ ] **PDF Support**: Extract content from PDF documents
- [ ] **Image OCR**: Extract text from images in articles
- [ ] **Better Summarization**: More sophisticated content summarization

### Future
- [ ] **Cache Viewer**: Simple web interface for cache management
- [ ] **Content Diffing**: Track changes in cached content over time
- [ ] **Webhook Support**: Notify when cached content changes
- [ ] **Plugin System**: Custom extractors for specific sites

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔐 Security

See [SECURITY.md](SECURITY.md) for security considerations and reporting vulnerabilities.

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines and submit pull requests for any improvements.

---

**Built with ❤️ for the MCP ecosystem**