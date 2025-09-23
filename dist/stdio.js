#!/usr/bin/env node
/**
 * STDIO launcher for MCP Web Scrape Server
 * Used for local connections with MCP clients like Claude Desktop
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
async function main() {
    // Handle help flag
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        console.log(`
MCP Web Scrape Server

Usage: mcp-web-scrape [options]

Options:
  --help, -h     Show this help message
  --version, -v  Show version information

This is an MCP (Model Context Protocol) server that provides web scraping capabilities.
It runs on STDIO and communicates using JSON-RPC messages.

Capabilities:
  - extract_content: Extract and convert web content to Markdown
  - summarize_content: Summarize web content
  - clear_cache: Clear the content cache

Resources:
  - cached content entries

For more information, visit: https://github.com/mukul975/mcp-web-scrape`);
        process.exit(0);
    }
    // Handle version flag
    if (process.argv.includes('--version') || process.argv.includes('-v')) {
        const packageJson = await import('../package.json', { assert: { type: 'json' } });
        console.log(packageJson.default.version);
        process.exit(0);
    }
    // Create the MCP server
    const server = createServer();
    // Create STDIO transport
    const transport = new StdioServerTransport();
    // Connect server to transport
    await server.connect(transport);
    // Log startup message to stderr (so it doesn't interfere with STDIO protocol)
    console.error('MCP Web Scrape Server started on STDIO');
    console.error('Server capabilities: extract_content, summarize_content, clear_cache');
    console.error('Resources: cached content entries');
}
// Handle graceful shutdown
process.on('SIGINT', () => {
    console.error('\nShutting down MCP Web Scrape Server...');
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.error('\nShutting down MCP Web Scrape Server...');
    process.exit(0);
});
// Start the server
main().catch((error) => {
    console.error('Failed to start MCP Web Scrape Server:', error);
    process.exit(1);
});
//# sourceMappingURL=stdio.js.map