# Security Policy

## 🔒 Security Philosophy

MCP Web Scrape is designed with security and responsible web scraping practices at its core. We prioritize:

- **Robots.txt compliance** - respecting website policies
- **Rate limiting** - preventing server overload
- **No paywall bypass** - ethical content access only
- **Safe content handling** - preventing XSS and injection attacks
- **Privacy protection** - no sensitive data logging

## 🛡️ Default Security Behaviors

### Robots.txt Compliance

- **Always checks** robots.txt before scraping
- **Respects disallow rules** for the configured user agent
- **Honors crawl delays** specified in robots.txt
- **Fails safely** if robots.txt cannot be accessed

```typescript
// Example: Automatic robots.txt validation
const isAllowed = await checkRobotsTxt(url, 'mcp-web-scrape');
if (!isAllowed) {
  throw new McpError(ErrorCode.InvalidRequest, 'Robots.txt disallows access');
}
```

### Rate Limiting

- **Per-domain rate limits** (default: 1 request/second)
- **Configurable delays** between requests
- **Exponential backoff** on rate limit errors
- **Respect server response headers** (Retry-After, etc.)

### Content Safety

- **HTML sanitization** during Markdown conversion
- **URL validation** to prevent SSRF attacks
- **Content-Type checking** before processing
- **Size limits** to prevent memory exhaustion

### Privacy Protection

- **No sensitive data logging** (URLs may be logged for debugging)
- **Local caching only** - no external data transmission
- **Configurable cache retention** periods
- **Cache encryption** for sensitive content (optional)

## 🚨 Supported Versions

We provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | ✅ Active support  |
| 0.9.x   | ⚠️ Critical fixes only |
| < 0.9   | ❌ No longer supported |

## 🐛 Reporting Security Vulnerabilities

**Please do NOT report security vulnerabilities through public GitHub issues.**

### Preferred Reporting Method

1. **Email**: Send details to `security@mcp-web-scrape.dev` (if available)
2. **GitHub Security Advisories**: Use the [private vulnerability reporting](https://github.com/mukul975/mcp-web-scrape/security/advisories/new) feature
3. **Encrypted communication**: PGP key available on request

### What to Include

- **Vulnerability description** - what is the security issue?
- **Impact assessment** - what could an attacker achieve?
- **Reproduction steps** - how to demonstrate the vulnerability
- **Affected versions** - which releases are impacted
- **Suggested fix** - if you have ideas for remediation
- **Disclosure timeline** - your preferred timeline for public disclosure

### Example Report Template

```
Subject: [SECURITY] Vulnerability in MCP Web Scrape v1.2.3

## Summary
Brief description of the vulnerability

## Impact
- Confidentiality: [High/Medium/Low]
- Integrity: [High/Medium/Low] 
- Availability: [High/Medium/Low]

## Reproduction
1. Step one
2. Step two
3. Observe vulnerability

## Affected Versions
- Version X.Y.Z through A.B.C

## Suggested Mitigation
Your ideas for fixing the issue

## Disclosure Timeline
Preferred timeline for coordinated disclosure
```

## 🔄 Security Response Process

### Our Commitment

- **Acknowledgment**: Within 24 hours of report
- **Initial assessment**: Within 72 hours
- **Regular updates**: Every 7 days until resolution
- **Coordinated disclosure**: Work with reporter on timeline

### Response Timeline

1. **Day 0**: Vulnerability reported
2. **Day 1**: Acknowledgment sent
3. **Day 3**: Initial assessment and severity rating
4. **Day 7**: Fix development begins (for confirmed issues)
5. **Day 14-30**: Patch release (depending on severity)
6. **Day 30-90**: Public disclosure (coordinated with reporter)

### Severity Levels

- **Critical**: Remote code execution, data exfiltration
- **High**: Privilege escalation, authentication bypass
- **Medium**: Information disclosure, DoS attacks
- **Low**: Minor information leaks, configuration issues

## 🏆 Security Hall of Fame

We recognize security researchers who help improve MCP Web Scrape:

<!-- Future contributors will be listed here -->

*Be the first to help secure MCP Web Scrape!*

## 🔧 Security Configuration

### Recommended Settings

```json
{
  "security": {
    "respectRobotsTxt": true,
    "userAgent": "mcp-web-scrape/1.0 (+https://github.com/mukul975/mcp-web-scrape)",
    "rateLimitPerDomain": 1000,
    "maxContentSize": "10MB",
    "allowedProtocols": ["http", "https"],
    "blockPrivateIPs": true,
    "sanitizeContent": true
  }
}
```

### Security Headers

When running the HTTP server, we recommend these headers:

```javascript
// Express.js example
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  next();
});
```

## 🚫 Out of Scope

The following are generally **not considered security vulnerabilities**:

- **Rate limiting bypasses** using multiple IPs/proxies
- **Robots.txt violations** when explicitly configured to ignore
- **Content extraction** from public, non-paywalled content
- **Performance issues** that don't lead to DoS
- **Social engineering** attacks against users
- **Physical access** to systems running MCP Web Scrape

## 📚 Security Resources

### Best Practices

- [OWASP Web Scraping Security](https://owasp.org/www-project-web-security-testing-guide/)
- [Responsible Web Scraping](https://blog.apify.com/web-scraping-ethics/)
- [Robots.txt Specification](https://www.robotstxt.org/)

### Security Tools

- **Static analysis**: ESLint security rules
- **Dependency scanning**: npm audit, Snyk
- **Runtime protection**: Helmet.js for HTTP servers
- **Monitoring**: Application security monitoring

## 📞 Contact Information

- **Security Email**: `security@mcp-web-scrape.dev` (if available)
- **GitHub Security**: [Private vulnerability reporting](https://github.com/mukul975/mcp-web-scrape/security)
- **Maintainer**: [@mukul975](https://github.com/mukul975)

---

**Last Updated**: January 2024

**Note**: This security policy is subject to change. Please check back regularly for updates.