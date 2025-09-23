/**
 * Configuration management for MCP Web Scrape Server
 * Handles environment variables and default settings
 */
export interface Config {
    httpPort: number;
    httpHost: string;
    userAgent: string;
    timeout: number;
    maxSize: number;
    maxRequestsPerMinute: number;
    cacheTtl: number;
    maxCacheEntries: number;
    respectRobots: boolean;
    robotsTimeout: number;
    allowedHosts: string[];
    blockedHosts: string[];
}
export declare function loadConfig(): Config;
export declare const config: Config;
//# sourceMappingURL=config.d.ts.map