# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.2] - 2024-12-19

### Fixed
- Fixed CSS selector syntax errors in social media detection
- Improved username extraction from social media URLs
- Eliminated false positives in social media link detection
- Enhanced platform-specific regex patterns for accurate username parsing
- Fixed contextual social media detection to prevent incorrect matches

### Added
- Initial release of mcp-web-scrape
- Web scraping tools for MCP (Model Context Protocol)
- Support for STDIO and SSE/HTTP transports
- Intelligent content extraction with readability algorithms
- Built-in caching system with configurable TTL
- Rate limiting and robots.txt compliance
- Content safety filtering
- Comprehensive error handling and logging

### Tools
- `fetch` - Fetch and cache web page content
- `extract` - Extract clean text from HTML using readability
- `summarize` - Generate AI-powered summaries of web content
- `list_cache` - List all cached resources
- `purge` - Clear cache entries

### Features
- 🚀 **Fast & Reliable** - Built-in caching and rate limiting
- 🛡️ **Safe by Default** - Robots.txt compliance and content filtering
- 🔧 **Easy Setup** - Works with ChatGPT Desktop and Claude Desktop
- 📊 **Rich Extraction** - Readability algorithm for clean content
- 🌐 **Multiple Transports** - STDIO and HTTP/SSE support
- 🐳 **Docker Ready** - Containerized deployment option

### Security
- Automatic robots.txt checking
- Rate limiting (1 request per second by default)
- Content safety filtering
- Input validation and sanitization
- Secure header handling

### Configuration
- Configurable cache TTL (default: 1 hour)
- Adjustable rate limiting
- Custom user agent support
- Flexible transport options
- Environment-based configuration

---

## Release Notes Template

### [Version] - YYYY-MM-DD

#### Added
- New features and capabilities

#### Changed
- Changes in existing functionality

#### Deprecated
- Soon-to-be removed features

#### Removed
- Removed features

#### Fixed
- Bug fixes

#### Security
- Security improvements

---

## Version History

- **v1.0.0** - Initial release with core web scraping functionality
- **v0.9.x** - Beta releases and testing
- **v0.1.x** - Alpha development and prototyping

## Migration Guide

When upgrading between major versions, please refer to the migration guides:

- [v1.0.0 Migration Guide](#) - Coming soon

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for information on how to contribute to this project.

## Support

For questions and support:
- 📖 [Documentation](README.md)
- 🐛 [Report Issues](https://github.com/mukul975/mcp-web-scrape/issues)
- 💬 [Discussions](https://github.com/mukul975/mcp-web-scrape/discussions)