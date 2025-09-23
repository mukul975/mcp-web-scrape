# Contributing to MCP Web Scrape

🎉 Thanks for your interest in contributing! We welcome all kinds of contributions, from bug reports to new features.

## 🚀 Quick Start

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/YOUR_USERNAME/mcp-web-scrape.git`
3. **Install** dependencies: `npm install`
4. **Build** the project: `npm run build`
5. **Test** your changes: `npm test`

## 🐛 Reporting Bugs

Found a bug? Please [open an issue](https://github.com/mukul975/mcp-web-scrape/issues/new?template=bug_report.md) with:

- **Clear description** of the problem
- **Steps to reproduce** the issue
- **Expected vs actual** behavior
- **Environment details** (Node.js version, OS, etc.)
- **Logs or error messages** if available

## 💡 Suggesting Features

Have an idea? [Open a feature request](https://github.com/mukul975/mcp-web-scrape/issues/new?template=feature_request.md) with:

- **Problem description** - what pain point does this solve?
- **Proposed solution** - how should it work?
- **Alternatives considered** - what other approaches did you think about?
- **Use cases** - when would this be useful?

## 🔧 Development Setup

### Prerequisites

- **Node.js 18+** (we test on 18.x, 20.x, 22.x)
- **npm** (comes with Node.js)
- **Git**

### Local Development

```bash
# Clone and setup
git clone https://github.com/mukul975/mcp-web-scrape.git
cd mcp-web-scrape
npm install

# Development workflow
npm run dev          # Watch mode with auto-rebuild
npm run build        # Production build
npm test            # Run test suite
npm run lint        # Check code style
npm run type-check  # TypeScript validation
```

### Project Structure

```
src/
├── server.ts       # Main MCP server implementation
├── cache.ts        # Content caching with ETag support
├── robots.ts       # Robots.txt validation
├── fetch.ts        # HTTP fetching with rate limiting
├── extract.ts      # Content extraction to Markdown
├── config.ts       # Configuration management
├── stdio.ts        # STDIO transport
└── http.ts         # HTTP/SSE transport
```

## 📝 Code Style

### TypeScript Guidelines

- **Use TypeScript** for all new code
- **Explicit types** for function parameters and returns
- **Interfaces** for object shapes
- **Enums** for constants with multiple values

```typescript
// ✅ Good
interface ExtractOptions {
  includeImages: boolean;
  format: 'markdown' | 'text' | 'json';
}

function extractContent(url: string, options: ExtractOptions): Promise<ExtractResult> {
  // implementation
}

// ❌ Avoid
function extractContent(url, options) {
  // implementation
}
```

### Formatting

- **2 spaces** for indentation
- **Single quotes** for strings
- **Trailing commas** in objects/arrays
- **Semicolons** required

We use Prettier for formatting. Run `npm run format` to auto-format your code.

### Error Handling

- **Always handle errors** explicitly
- **Use McpError** for MCP-specific errors
- **Provide helpful error messages**

```typescript
// ✅ Good
try {
  const result = await fetchUrl(url);
  return result;
} catch (error) {
  throw new McpError(
    ErrorCode.InternalError,
    `Failed to fetch ${url}: ${error.message}`
  );
}
```

## 🧪 Testing

### Writing Tests

- **Test new features** and bug fixes
- **Use descriptive test names**
- **Mock external dependencies**
- **Test error conditions**

```typescript
// ✅ Good test structure
describe('extractContent', () => {
  it('should extract clean markdown from HTML', async () => {
    const mockHtml = '<h1>Title</h1><p>Content</p>';
    const result = await extractContent(mockHtml, 'https://example.com');
    
    expect(result.content).toContain('# Title');
    expect(result.content).toContain('Content');
  });
  
  it('should handle malformed HTML gracefully', async () => {
    const malformedHtml = '<h1>Unclosed tag<p>Content';
    const result = await extractContent(malformedHtml, 'https://example.com');
    
    expect(result.content).toBeDefined();
  });
});
```

### Running Tests

```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode
npm test -- --coverage # With coverage report
```

## 📋 Pull Request Process

### Before Submitting

1. **Create a branch** from `main`: `git checkout -b feature/your-feature-name`
2. **Make your changes** with clear, focused commits
3. **Add tests** for new functionality
4. **Update documentation** if needed
5. **Run the full test suite**: `npm test`
6. **Check code style**: `npm run lint`
7. **Build successfully**: `npm run build`

### PR Guidelines

- **Clear title** describing the change
- **Detailed description** explaining what and why
- **Link related issues** using "Fixes #123" or "Closes #123"
- **Small, focused changes** - one feature/fix per PR
- **Update CHANGELOG.md** for user-facing changes

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests pass locally
- [ ] Added tests for new functionality
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
```

## 🎯 Good First Issues

Looking for ways to contribute? Check out issues labeled [`good first issue`](https://github.com/mukul975/mcp-web-scrape/labels/good%20first%20issue):

- **Add new extractors** for specific content types
- **Improve error messages** with more context
- **Write additional tests** for edge cases
- **Enhance documentation** with examples
- **Fix typos** in comments or docs

## 🏗️ Architecture Decisions

### Adding New Tools

1. **Define the tool** in the `ListToolsRequestSchema` handler
2. **Implement the handler** in the `CallToolRequestSchema` switch
3. **Add input validation** and error handling
4. **Write comprehensive tests**
5. **Update documentation**

### Adding New Extractors

1. **Create extractor function** in `src/extract.ts`
2. **Handle different content types** gracefully
3. **Preserve source attribution**
4. **Test with real-world examples**

### Cache Considerations

- **Respect HTTP caching headers** (ETag, Last-Modified)
- **Implement cache invalidation** strategies
- **Consider memory usage** for large caches
- **Test cache behavior** thoroughly

## 🤝 Community Guidelines

- **Be respectful** and inclusive
- **Help others** learn and contribute
- **Give constructive feedback** on PRs
- **Follow the [Code of Conduct](CODE_OF_CONDUCT.md)**

## 📞 Getting Help

- **GitHub Issues** - for bugs and feature requests
- **GitHub Discussions** - for questions and ideas
- **Discord** - real-time chat (link in README)

## 🎉 Recognition

Contributors are recognized in:

- **CHANGELOG.md** for significant contributions
- **README.md** contributors section
- **GitHub releases** with contributor highlights

---

**Thank you for contributing to MCP Web Scrape!** 🚀