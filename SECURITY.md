# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Default Security Guardrails

The MCP Web Scrape Server is designed with security and responsible behavior as core principles. The following guardrails are enabled by default:

### 🤖 Robots.txt Compliance

- **Default Behavior**: Always checks and respects `robots.txt` files
- **Bypass Option**: Available via `MCP_RESPECT_ROBOTS=false` or `bypassRobots` parameter
- **Recommendation**: Only bypass when you have explicit permission or legitimate need
- **Cache**: Robots.txt files are cached for 1 hour to reduce server load

### 🚦 Rate Limiting

- **Per-Host Limits**: Maximum 30 requests per minute per hostname
- **Backoff Strategy**: Automatically handles 429 (Too Many Requests) responses
- **Configurable**: Adjust via `MCP_MAX_REQUESTS_PER_MINUTE` environment variable
- **Memory-Based**: Rate limits reset on server restart

### 📏 Size and Time Limits

- **Download Size**: Limited to 5MB by default (`MCP_MAX_SIZE`)
- **Request Timeout**: 30-second timeout prevents hanging requests (`MCP_TIMEOUT`)
- **Content Truncation**: Long content is truncated with clear indication
- **Memory Protection**: Prevents excessive memory usage from large responses

### 🧹 Content Sanitization

- **Script Removal**: All `<script>` tags and JavaScript are stripped
- **Style Removal**: CSS and `<style>` tags are removed
- **Safe HTML**: Only content-relevant HTML elements are preserved
- **XSS Prevention**: Output is safe for display in web interfaces

### 🔒 Network Security

- **HTTPS Preferred**: Automatically upgrades HTTP to HTTPS when possible
- **Host Filtering**: Optional allowlist/blocklist for target domains
- **User-Agent**: Clear identification as `mcp-web-scrape/1.0`
- **No Credential Forwarding**: Does not send authentication headers

## What This Server Does NOT Do

### ❌ No Authentication Bypass

- Does not attempt to bypass login pages
- Does not store or forward authentication credentials
- Cannot access content behind paywalls or subscriptions
- Respects HTTP authentication challenges

### ❌ No Aggressive Crawling

- Does not follow links automatically
- Does not perform recursive site crawling
- Does not ignore rate limiting or server responses
- Does not attempt to overwhelm target servers

### ❌ No Privacy Violations

- Does not attempt to access private or internal networks
- Does not bypass geographic restrictions
- Does not store sensitive information from pages
- Does not forward user-specific cookies or sessions

### ❌ No Malicious Behavior

- Does not attempt to exploit vulnerabilities
- Does not perform port scanning or network reconnaissance
- Does not inject malicious content into responses
- Does not attempt to bypass security measures

## Configuration Security

### Environment Variables

Sensitive configuration should be managed through environment variables:

```bash
# Safe to log/share
MCP_HTTP_PORT=3000
MCP_TIMEOUT=30000
MCP_MAX_SIZE=5242880

# Review before sharing
MCP_ALLOWED_HOSTS="example.com,trusted-site.org"
MCP_BLOCKED_HOSTS="malicious-site.com"

# Security-sensitive
MCP_RESPECT_ROBOTS=true  # Should remain true in production
```

### Host Filtering

Use host filtering to restrict which domains the server can access:

```bash
# Allow only specific domains
MCP_ALLOWED_HOSTS="wikipedia.org,github.com,stackoverflow.com"

# Block specific domains
MCP_BLOCKED_HOSTS="malicious-site.com,spam-domain.net"

# Wildcard support
MCP_ALLOWED_HOSTS="*.wikipedia.org,*.github.com"
```

### Production Deployment

For production deployments:

1. **Enable Host Filtering**: Use `MCP_ALLOWED_HOSTS` to restrict target domains
2. **Monitor Rate Limits**: Adjust `MCP_MAX_REQUESTS_PER_MINUTE` based on usage
3. **Set Reasonable Limits**: Configure `MCP_MAX_SIZE` and `MCP_TIMEOUT` appropriately
4. **Keep Robots Enabled**: Leave `MCP_RESPECT_ROBOTS=true` unless absolutely necessary
5. **Use HTTPS**: Deploy behind HTTPS proxy for encrypted transport
6. **Monitor Logs**: Watch for unusual access patterns or errors

## Cache Security

### Data Storage

- **In-Memory Only**: Cache is stored in memory, not persisted to disk
- **Automatic Cleanup**: Old entries are automatically evicted (LRU)
- **No Sensitive Data**: Only public web content is cached
- **Clear on Restart**: All cached data is lost when server restarts

### Cache Management

- **Inspection**: Cache contents can be listed via MCP resources
- **Selective Clearing**: Individual URLs can be removed from cache
- **Bulk Clearing**: Entire cache can be cleared via `clear_cache` tool
- **TTL Enforcement**: Cached content expires based on `MCP_CACHE_TTL`

## HTTP Transport Security

### CORS Configuration

```javascript
// Development: Allow all origins
cors({ origin: true })

// Production: Restrict origins
cors({ 
  origin: ['https://your-app.com', 'https://trusted-client.com'],
  credentials: true 
})
```

### Security Headers

The HTTP server includes security headers via Helmet.js:

- Content Security Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy
- X-XSS-Protection

### Rate Limiting

HTTP endpoints include additional rate limiting:

- Per-IP request limits
- Burst protection
- Automatic blocking of abusive clients

## Reporting Security Vulnerabilities

### Responsible Disclosure

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** create a public GitHub issue
2. **Do NOT** discuss the vulnerability publicly
3. **Do** email security details to: [security@your-domain.com]
4. **Do** provide clear reproduction steps
5. **Do** allow reasonable time for response and fix

### What to Include

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Suggested fix (if known)
- Your contact information

### Response Timeline

- **24 hours**: Initial acknowledgment
- **72 hours**: Preliminary assessment
- **7 days**: Detailed response with timeline
- **30 days**: Target resolution (varies by severity)

## Security Best Practices

### For Developers

1. **Input Validation**: Always validate URLs and parameters
2. **Output Encoding**: Ensure safe output encoding for target format
3. **Error Handling**: Don't leak sensitive information in error messages
4. **Dependency Updates**: Keep dependencies updated for security patches
5. **Code Review**: Review security-sensitive changes carefully

### For Operators

1. **Network Isolation**: Deploy in isolated network segments when possible
2. **Monitoring**: Monitor for unusual traffic patterns or errors
3. **Logging**: Log security-relevant events (blocked requests, rate limits)
4. **Updates**: Keep the server updated with latest security patches
5. **Backup**: Regularly backup configuration and monitor for changes

### For Users

1. **Trusted Sources**: Only fetch content from trusted domains
2. **Review Output**: Review extracted content before using in applications
3. **Rate Awareness**: Be mindful of rate limits and server resources
4. **Robots Respect**: Keep robots.txt compliance enabled unless necessary
5. **Report Issues**: Report suspicious behavior or potential security issues

## Compliance Considerations

### Legal Compliance

- **Copyright**: Respect copyright and fair use guidelines
- **Terms of Service**: Honor website terms of service
- **Privacy Laws**: Comply with applicable privacy regulations
- **Robots.txt**: Follow robots.txt directives (enabled by default)

### Ethical Use

- **Server Resources**: Don't overwhelm target servers
- **Content Respect**: Use extracted content responsibly
- **Attribution**: Maintain proper citations and source attribution
- **Permission**: Obtain permission when required

---

**Last Updated**: January 2024
**Version**: 1.0.0