/**
 * HTTP fetching with caching and rate limiting for MCP Web Scrape Server
 */
import fetch from 'node-fetch';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { config } from './config.js';
import { cache } from './cache.js';
import { checkUrlAllowed } from './robots.js';
export class FetchError extends Error {
    code;
    statusCode;
    url;
    constructor(message, code, statusCode, url) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.url = url;
        this.name = 'FetchError';
    }
}
// Rate limiter per host
const rateLimiters = new Map();
/**
 * Get or create rate limiter for a host
 */
function getRateLimiter(hostname) {
    let limiter = rateLimiters.get(hostname);
    if (!limiter) {
        limiter = new RateLimiterMemory({
            points: config.maxRequestsPerMinute,
            duration: 60, // per minute
        });
        rateLimiters.set(hostname, limiter);
    }
    return limiter;
}
/**
 * Validate URL and check security constraints
 */
function validateUrl(url) {
    let parsedUrl;
    try {
        parsedUrl = new URL(url);
    }
    catch (error) {
        throw new FetchError('Invalid URL format', 'INVALID_URL', undefined, url);
    }
    // Check protocol
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new FetchError('Only HTTP and HTTPS URLs are supported', 'INVALID_PROTOCOL', undefined, url);
    }
    // Check blocked hosts
    if (config.blockedHosts.includes(parsedUrl.hostname)) {
        throw new FetchError('Host is blocked', 'BLOCKED_HOST', undefined, url);
    }
    // Check allowed hosts (if specified)
    if (config.allowedHosts.length > 0 && !config.allowedHosts.includes(parsedUrl.hostname)) {
        throw new FetchError('Host is not in allowed list', 'HOST_NOT_ALLOWED', undefined, url);
    }
}
/**
 * Check rate limiting for a URL
 */
async function checkRateLimit(url) {
    const hostname = new URL(url).hostname;
    const limiter = getRateLimiter(hostname);
    try {
        await limiter.consume(hostname);
    }
    catch (rateLimiterRes) {
        const secs = Math.round(rateLimiterRes.msBeforeNext / 1000) || 1;
        throw new FetchError(`Rate limit exceeded for ${hostname}. Try again in ${secs} seconds`, 'RATE_LIMITED', 429, url);
    }
}
/**
 * Fetch content from URL with caching and rate limiting
 */
export async function fetchUrl(url, options = {}) {
    const { bypassRobots = false, forceRefresh = false } = options;
    // Validate URL
    validateUrl(url);
    // Check robots.txt
    const robotsResult = await checkUrlAllowed(url, bypassRobots);
    if (!robotsResult.allowed) {
        throw new FetchError(`Access denied by robots.txt: ${robotsResult.reason}`, 'ROBOTS_DENIED', 403, url);
    }
    // Check rate limiting
    await checkRateLimit(url);
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
        const cached = cache.get(url);
        if (cached) {
            const result = {
                content: cached.content,
                url: cached.url,
                fromCache: true,
                timestamp: cached.timestamp,
                size: cached.size
            };
            if (cached.title)
                result.title = cached.title;
            if (cached.contentType)
                result.contentType = cached.contentType;
            if (cached.etag)
                result.etag = cached.etag;
            if (cached.lastModified)
                result.lastModified = cached.lastModified;
            return result;
        }
    }
    // Prepare headers
    const headers = {
        'User-Agent': config.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
    };
    // Add conditional headers if we have cached version
    const conditionalHeaders = cache.getConditionalHeaders(url);
    Object.assign(headers, conditionalHeaders);
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers,
            redirect: 'follow',
            signal: AbortSignal.timeout(config.timeout)
        });
        // Handle 304 Not Modified
        if (response.status === 304) {
            const cached = cache.get(url);
            if (cached) {
                const result = {
                    content: cached.content,
                    url: cached.url,
                    fromCache: true,
                    cacheHit: true,
                    timestamp: cached.timestamp,
                    size: cached.size
                };
                if (cached.title)
                    result.title = cached.title;
                if (cached.contentType)
                    result.contentType = cached.contentType;
                if (cached.etag)
                    result.etag = cached.etag;
                if (cached.lastModified)
                    result.lastModified = cached.lastModified;
                return result;
            }
        }
        // Handle other HTTP errors
        if (!response.ok) {
            throw new FetchError(`HTTP ${response.status}: ${response.statusText}`, 'HTTP_ERROR', response.status, url);
        }
        // Check content type
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
            throw new FetchError(`Unsupported content type: ${contentType}`, 'UNSUPPORTED_CONTENT_TYPE', 415, url);
        }
        // Check content length
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > config.maxSize) {
            throw new FetchError(`Content too large: ${contentLength} bytes (max: ${config.maxSize})`, 'CONTENT_TOO_LARGE', 413, url);
        }
        // Read content with size limit
        const content = await response.text();
        if (content.length > config.maxSize) {
            throw new FetchError(`Content too large: ${content.length} bytes (max: ${config.maxSize})`, 'CONTENT_TOO_LARGE', 413, url);
        }
        // Extract cache headers
        const etag = response.headers.get('etag') || undefined;
        const lastModified = response.headers.get('last-modified') || undefined;
        const finalUrl = response.url || url;
        // Create cache entry
        const cacheEntry = {
            url: finalUrl,
            content,
            title: '', // Will be filled by extract module
            timestamp: Date.now(),
            size: content.length,
            contentType
        };
        if (etag)
            cacheEntry.etag = etag;
        if (lastModified)
            cacheEntry.lastModified = lastModified;
        // Store in cache
        cache.set(cacheEntry);
        const result = {
            content,
            url: finalUrl,
            fromCache: false,
            timestamp: Date.now(),
            size: content.length
        };
        if (contentType)
            result.contentType = contentType;
        if (etag)
            result.etag = etag;
        if (lastModified)
            result.lastModified = lastModified;
        return result;
    }
    catch (error) {
        if (error instanceof FetchError) {
            throw error;
        }
        // Handle network errors
        if (error instanceof Error) {
            if (error.name === 'AbortError') {
                throw new FetchError(`Request timeout after ${config.timeout}ms`, 'TIMEOUT', 408, url);
            }
            throw new FetchError(`Network error: ${error.message}`, 'NETWORK_ERROR', undefined, url);
        }
        throw new FetchError('Unknown error occurred', 'UNKNOWN_ERROR', undefined, url);
    }
}
/**
 * Get rate limiter statistics
 */
export function getRateLimiterStats() {
    const stats = {};
    for (const [hostname] of rateLimiters) {
        stats[hostname] = {
            points: config.maxRequestsPerMinute,
            duration: 60
        };
    }
    return stats;
}
//# sourceMappingURL=fetch.js.map