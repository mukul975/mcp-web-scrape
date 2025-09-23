# Examples

This directory contains various examples and configurations for using mcp-web-scrape in different environments and with different clients.

## 📁 Files Overview

### Configuration Files
- **`claude-desktop-config.json`** - Configuration for Claude Desktop (STDIO mode)
- **`chatgpt-desktop-config.json`** - Configuration for ChatGPT Desktop (HTTP mode)
- **`docker-compose.yml`** - Docker Compose setup for containerized deployment

### Client Examples
- **`generic-client.js`** - Node.js client examples (HTTP/SSE and STDIO)
- **`python-client.py`** - Python client with sync/async examples
- **`cli-usage.md`** - Comprehensive CLI usage guide

## 🚀 Quick Start

### 1. Claude Desktop Setup

1. Copy the configuration:
   ```bash
   cp examples/claude-desktop-config.json ~/.config/claude-desktop/
   ```

2. Update the path in the config to point to your installation:
   ```json
   {
     "mcpServers": {
       "web-scrape": {
         "command": "npx",
         "args": ["mcp-web-scrape"]
       }
     }
   }
   ```

3. Restart Claude Desktop

### 2. ChatGPT Desktop Setup

1. Start the HTTP server:
   ```bash
   npx mcp-web-scrape --transport http
   ```

2. Add the configuration to ChatGPT Desktop using the `chatgpt-desktop-config.json` example

### 3. Docker Setup

```bash
# Using Docker Compose
docker-compose up -d

# Or build and run manually
docker build -t mcp-web-scrape .
docker run -p 3000:3000 mcp-web-scrape --transport http
```

## 📖 Detailed Examples

### Node.js Client (`generic-client.js`)

Shows how to:
- Connect via HTTP/SSE and STDIO
- Call tools programmatically
- Handle errors and responses
- Manage cache and resources
- Batch process multiple URLs

```bash
# Run the example
node examples/generic-client.js
```

### Python Client (`python-client.py`)

Includes:
- Synchronous and asynchronous clients
- Batch processing examples
- Cache management
- Error handling
- Concurrent request processing

```bash
# Install dependencies
pip install requests aiohttp

# Run the example
python examples/python-client.py
```

### CLI Usage (`cli-usage.md`)

Comprehensive guide covering:
- Environment variables
- Docker deployment
- Production configurations
- Troubleshooting
- Performance tuning
- Integration with systemd, PM2, nginx

## 🔧 Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_HTTP_PORT` | `3000` | HTTP server port |
| `MCP_HTTP_HOST` | `localhost` | HTTP server host |
| `MCP_RESPECT_ROBOTS` | `true` | Respect robots.txt |
| `MCP_MAX_SIZE` | `5242880` | Max content size (5MB) |
| `MCP_TIMEOUT` | `30000` | Request timeout (30s) |
| `MCP_MAX_REQUESTS_PER_MINUTE` | `60` | Rate limit |
| `MCP_CACHE_TTL` | `3600000` | Cache TTL (1 hour) |
| `MCP_MAX_CACHE_ENTRIES` | `1000` | Max cache entries |
| `MCP_USER_AGENT` | `mcp-web-scrape/1.0` | User agent string |
| `MCP_ALLOWED_HOSTS` | `*` | Allowed hosts (comma-separated) |
| `MCP_BLOCKED_HOSTS` | `` | Blocked hosts (comma-separated) |

### Transport Modes

#### STDIO Mode (Default)
- Best for: Claude Desktop, local development
- Communication: Standard input/output
- Configuration: Simple command and args

#### HTTP/SSE Mode
- Best for: ChatGPT Desktop, web applications, remote access
- Communication: HTTP with Server-Sent Events
- Configuration: URL and headers

## 🛠️ Development Examples

### Custom Client Development

```javascript
// Basic HTTP client
const response = await fetch('http://localhost:3000/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'fetch',
      arguments: { url: 'https://example.com' }
    }
  })
});

const result = await response.json();
console.log(result.result);
```

### Error Handling

```javascript
try {
  const result = await client.callTool({
    name: 'fetch',
    arguments: { url: 'https://invalid-url' }
  });
} catch (error) {
  if (error.code === 'NETWORK_ERROR') {
    console.log('Network issue, retrying...');
  } else if (error.code === 'ROBOTS_BLOCKED') {
    console.log('Blocked by robots.txt');
  } else {
    console.log('Unknown error:', error.message);
  }
}
```

## 🐳 Docker Examples

### Basic Docker Run
```bash
# STDIO mode
docker run -i mcp-web-scrape

# HTTP mode
docker run -p 3000:3000 mcp-web-scrape --transport http
```

### Production Docker Setup
```bash
docker run -d \
  --name mcp-web-scrape \
  --restart unless-stopped \
  -p 3000:3000 \
  -e MCP_RESPECT_ROBOTS=true \
  -e MCP_MAX_REQUESTS_PER_MINUTE=30 \
  -e MCP_CACHE_TTL=7200000 \
  mcp-web-scrape --transport http
```

### Docker Compose
See `docker-compose.yml` for a complete production setup with:
- Health checks
- Resource limits
- Environment configuration
- Volume mounts for persistence
- Network configuration

## 🔍 Testing Examples

### Health Check
```bash
# HTTP mode
curl http://localhost:3000/health

# Expected: {"status":"ok","timestamp":"..."}
```

### Tool Testing
```bash
# Test fetch tool
curl -X POST http://localhost:3000/message \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "fetch",
      "arguments": {"url": "https://example.com"}
    }
  }'
```

### Load Testing
```bash
# Using Apache Bench
ab -n 100 -c 10 -T application/json -p test-payload.json http://localhost:3000/message

# Using curl in a loop
for i in {1..10}; do
  curl -s http://localhost:3000/health > /dev/null
  echo "Request $i completed"
done
```

## 🚨 Troubleshooting

### Common Issues

1. **Server not responding**
   ```bash
   # Check if server is running
   curl http://localhost:3000/health
   
   # Check logs
   docker logs mcp-web-scrape
   ```

2. **Rate limiting errors**
   ```bash
   # Increase rate limit
   MCP_MAX_REQUESTS_PER_MINUTE=120 mcp-web-scrape --transport http
   ```

3. **Memory issues**
   ```bash
   # Reduce cache size
   MCP_MAX_CACHE_ENTRIES=100 mcp-web-scrape
   ```

4. **Permission errors**
   ```bash
   # Use non-privileged port
   mcp-web-scrape --transport http --port 8080
   ```

### Debug Mode
```bash
# Enable debug logging
DEBUG=mcp-web-scrape:* mcp-web-scrape --transport http

# JSON structured logs
MCP_LOG_FORMAT=json mcp-web-scrape --transport http
```

## 📚 Additional Resources

- [Main README](../README.md) - Project overview and installation
- [CONTRIBUTING](../CONTRIBUTING.md) - Development guidelines
- [SECURITY](../SECURITY.md) - Security considerations
- [CHANGELOG](../CHANGELOG.md) - Version history
- [CLI Usage Guide](cli-usage.md) - Detailed CLI documentation

## 🤝 Contributing Examples

We welcome contributions of new examples! Please:

1. Follow the existing code style
2. Include comprehensive comments
3. Add error handling
4. Update this README
5. Test your examples thoroughly

See [CONTRIBUTING.md](../CONTRIBUTING.md) for detailed guidelines.

## 📄 License

All examples are provided under the same license as the main project. See [LICENSE](../LICENSE) for details.