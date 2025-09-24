/**
 * Configuration management for MCP Web Scrape Server
 * Handles environment variables and default settings
 */
function parseBoolean(value, defaultValue) {
    if (!value)
        return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
}
function parseNumber(value, defaultValue) {
    if (!value)
        return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}
function parseArray(value, defaultValue) {
    if (!value)
        return defaultValue;
    return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
}
export function loadConfig() {
    return {
        // Server settings
        httpPort: parseNumber(process.env['PORT'] || process.env['MCP_WS_PORT'], 3000),
        httpHost: process.env['MCP_WS_HOST'] || '0.0.0.0',
        // Fetching settings
        userAgent: process.env['MCP_WS_USER_AGENT'] || 'MCP-Web-Scrape/1.0.0 (+https://github.com/modelcontextprotocol/mcp-web-scrape)',
        timeout: parseNumber(process.env['MCP_WS_TIMEOUT'], 10000),
        maxSize: parseNumber(process.env['MCP_WS_MAX_SIZE'], 5 * 1024 * 1024), // 5MB
        // Rate limiting
        maxRequestsPerMinute: parseNumber(process.env['MCP_WS_RATE_LIMIT'], 30),
        // Cache settings
        cacheTtl: parseNumber(process.env['MCP_WS_CACHE_TTL'], 3600), // 1 hour
        maxCacheEntries: parseNumber(process.env['MCP_WS_MAX_CACHE_ENTRIES'], 1000),
        // Robots.txt settings
        respectRobots: parseBoolean(process.env['MCP_WS_RESPECT_ROBOTS'], true),
        robotsTimeout: parseNumber(process.env['MCP_WS_ROBOTS_TIMEOUT'], 5000),
        // Security settings
        allowedHosts: parseArray(process.env['MCP_WS_ALLOWED_HOSTS'], []),
        blockedHosts: parseArray(process.env['MCP_WS_BLOCKED_HOSTS'], ['localhost', '127.0.0.1', '0.0.0.0', '::1'])
    };
}
export const config = loadConfig();
//# sourceMappingURL=config.js.map