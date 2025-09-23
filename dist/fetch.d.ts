/**
 * HTTP fetching with caching and rate limiting for MCP Web Scrape Server
 */
export interface FetchOptions {
    bypassRobots?: boolean;
    forceRefresh?: boolean;
    maxRedirects?: number;
}
export interface FetchResult {
    content: string;
    url: string;
    title?: string | undefined;
    contentType?: string | undefined;
    fromCache: boolean;
    cacheHit?: boolean | undefined;
    timestamp: number;
    size: number;
    etag?: string | undefined;
    lastModified?: string | undefined;
}
export declare class FetchError extends Error {
    code: string;
    statusCode?: number | undefined;
    url?: string | undefined;
    constructor(message: string, code: string, statusCode?: number | undefined, url?: string | undefined);
}
/**
 * Fetch content from URL with caching and rate limiting
 */
export declare function fetchUrl(url: string, options?: FetchOptions): Promise<FetchResult>;
/**
 * Get rate limiter statistics
 */
export declare function getRateLimiterStats(): Record<string, any>;
//# sourceMappingURL=fetch.d.ts.map