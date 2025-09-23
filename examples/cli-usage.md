# CLI Usage Examples

This document shows various ways to use mcp-web-scrape from the command line.

## Quick Start

```bash
# Install globally
npm install -g mcp-web-scrape

# Or run directly with npx
npx mcp-web-scrape
```

## STDIO Mode (Default)

```bash
# Start the server in STDIO mode
mcp-web-scrape

# With custom configuration
MCP_CACHE_TTL=7200000 MCP_MAX_REQUESTS_PER_MINUTE=60 mcp-web-scrape
```

## HTTP/SSE Mode

```bash
# Start HTTP server on default port (3000)
mcp-web-scrape --transport http

# Custom port and host
mcp-web-scrape --transport http --port 8080 --host 0.0.0.0

# With environment variables
MCP_HTTP_PORT=8080 MCP_HTTP_HOST=0.0.0.0 mcp-web-scrape --transport http
```

## Configuration Examples

### Basic Configuration
```bash
# Respect robots.txt (default: true)
MCP_RESPECT_ROBOTS=true mcp-web-scrape

# Set cache TTL to 2 hours
MCP_CACHE_TTL=7200000 mcp-web-scrape

# Limit to 30 requests per minute
MCP_MAX_REQUESTS_PER_MINUTE=30 mcp-web-scrape
```

### Advanced Configuration
```bash
# Custom user agent
MCP_USER_AGENT="MyBot/1.0 (+https://mysite.com/bot)" mcp-web-scrape

# Restrict to specific hosts
MCP_ALLOWED_HOSTS="example.com,news.ycombinator.com" mcp-web-scrape

# Block specific hosts
MCP_BLOCKED_HOSTS="spam.com,malware.site" mcp-web-scrape

# Set maximum content size (5MB)
MCP_MAX_SIZE=5242880 mcp-web-scrape
```

### Production Configuration
```bash
# Production-ready setup
MCP_RESPECT_ROBOTS=true \
MCP_MAX_REQUESTS_PER_MINUTE=30 \
MCP_CACHE_TTL=3600000 \
MCP_MAX_CACHE_ENTRIES=1000 \
MCP_TIMEOUT=30000 \
MCP_USER_AGENT="mcp-web-scrape/1.0 (+https://github.com/mukul975/mcp-web-scrape)" \
mcp-web-scrape --transport http --port 3000
```

## Docker Usage

### Basic Docker Run
```bash
# Build the image
docker build -t mcp-web-scrape .

# Run in STDIO mode
docker run -i mcp-web-scrape

# Run HTTP server
docker run -p 3000:3000 -e MCP_HTTP_PORT=3000 mcp-web-scrape --transport http
```

### Docker with Custom Configuration
```bash
docker run -p 3000:3000 \
  -e MCP_RESPECT_ROBOTS=true \
  -e MCP_MAX_REQUESTS_PER_MINUTE=60 \
  -e MCP_CACHE_TTL=7200000 \
  -e MCP_USER_AGENT="MyApp/1.0" \
  mcp-web-scrape --transport http
```

### Docker Compose
See `docker-compose.yml` for a complete setup example.

## Testing the Server

### Health Check
```bash
# For HTTP mode
curl http://localhost:3000/health

# Expected response: {"status":"ok","timestamp":"..."}
```

### Manual Tool Testing
```bash
# Using curl to test fetch tool (HTTP mode)
curl -X POST http://localhost:3000/call \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "fetch",
      "arguments": {
        "url": "https://example.com"
      }
    }
  }'
```

## Environment Variables Reference

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

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Check what's using the port
   lsof -i :3000
   
   # Use a different port
   mcp-web-scrape --transport http --port 3001
   ```

2. **Permission denied**
   ```bash
   # Run with sudo (not recommended for production)
   sudo mcp-web-scrape --transport http --port 80
   
   # Or use a non-privileged port
   mcp-web-scrape --transport http --port 8080
   ```

3. **Memory issues**
   ```bash
   # Reduce cache size
   MCP_MAX_CACHE_ENTRIES=100 mcp-web-scrape
   
   # Reduce content size limit
   MCP_MAX_SIZE=1048576 mcp-web-scrape  # 1MB
   ```

### Debug Mode
```bash
# Enable debug logging
DEBUG=mcp-web-scrape:* mcp-web-scrape

# Or use NODE_DEBUG
NODE_DEBUG=mcp-web-scrape mcp-web-scrape
```

### Logs
```bash
# Redirect logs to file
mcp-web-scrape --transport http 2>&1 | tee server.log

# JSON structured logs
MCP_LOG_FORMAT=json mcp-web-scrape --transport http
```

## Performance Tuning

### High-Traffic Setup
```bash
# Increase rate limits and cache
MCP_MAX_REQUESTS_PER_MINUTE=120 \
MCP_MAX_CACHE_ENTRIES=5000 \
MCP_CACHE_TTL=7200000 \
mcp-web-scrape --transport http
```

### Low-Memory Setup
```bash
# Reduce memory usage
MCP_MAX_CACHE_ENTRIES=50 \
MCP_MAX_SIZE=1048576 \
MCP_CACHE_TTL=1800000 \
mcp-web-scrape
```

### Development Setup
```bash
# Fast iteration, no caching
MCP_CACHE_TTL=0 \
MCP_MAX_REQUESTS_PER_MINUTE=300 \
mcp-web-scrape --transport http
```

## Integration Examples

### With systemd
```bash
# Create service file
sudo tee /etc/systemd/system/mcp-web-scrape.service << EOF
[Unit]
Description=MCP Web Scrape Server
After=network.target

[Service]
Type=simple
User=mcp
WorkingDirectory=/opt/mcp-web-scrape
Environment=MCP_HTTP_PORT=3000
Environment=MCP_RESPECT_ROBOTS=true
ExecStart=/usr/bin/node dist/http.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl enable mcp-web-scrape
sudo systemctl start mcp-web-scrape
```

### With PM2
```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start "mcp-web-scrape --transport http" --name mcp-web-scrape

# Save PM2 configuration
pm2 save
pm2 startup
```

### With nginx (Reverse Proxy)
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```