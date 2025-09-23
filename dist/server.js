/**
 * MCP Web Scrape Server
 * Implements the Model Context Protocol for web content extraction
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ErrorCode, ListResourcesRequestSchema, ListToolsRequestSchema, McpError, ReadResourceRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { fetchUrl } from './fetch.js';
import { extractContent, summarizeContent } from './extract.js';
import { cache } from './cache.js';
/**
 * Calculate text similarity using a simple algorithm
 */
function calculateTextSimilarity(text1, text2) {
    if (text1 === text2)
        return 1.0;
    if (text1.length === 0 || text2.length === 0)
        return 0.0;
    // Simple word-based similarity
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
}
/**
 * Create and configure the MCP server
 */
export function createServer() {
    const server = new Server({
        name: 'mcp-web-scrape',
        version: '1.0.0',
    }, {
        capabilities: {
            tools: {},
            resources: {},
        },
    });
    // List available tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [
                {
                    name: 'extract_content',
                    description: 'Extract and clean content from a web page, returning Markdown with citation',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url: {
                                type: 'string',
                                description: 'The URL to fetch and extract content from',
                            },
                            format: {
                                type: 'string',
                                enum: ['markdown', 'text', 'json'],
                                description: 'Output format (default: markdown)',
                                default: 'markdown',
                            },
                            includeImages: {
                                type: 'boolean',
                                description: 'Whether to include images in the output (default: true)',
                                default: true,
                            },
                            includeLinks: {
                                type: 'boolean',
                                description: 'Whether to include links in the output (default: true)',
                                default: true,
                            },
                            bypassRobots: {
                                type: 'boolean',
                                description: 'Whether to bypass robots.txt restrictions (default: false)',
                                default: false,
                            },
                            useCache: {
                                type: 'boolean',
                                description: 'Whether to use cached content if available (default: true)',
                                default: true,
                            },
                        },
                        required: ['url'],
                    },
                },
                {
                    name: 'summarize_content',
                    description: 'Generate a summary of already extracted content',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            content: {
                                type: 'string',
                                description: 'The content to summarize',
                            },
                            maxLength: {
                                type: 'number',
                                description: 'Maximum length of the summary (default: 500)',
                                default: 500,
                            },
                            format: {
                                type: 'string',
                                enum: ['paragraph', 'bullets'],
                                description: 'Summary format (default: paragraph)',
                                default: 'paragraph',
                            },
                        },
                        required: ['content'],
                    },
                },
                {
                    name: 'clear_cache',
                    description: 'Clear cached content entries',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url: {
                                type: 'string',
                                description: 'Specific URL to clear from cache (if not provided, clears all)',
                            },
                        },
                        required: [],
                    },
                },
                {
                    name: 'get_page_metadata',
                    description: 'Extract meta tags, title, description, keywords from web pages',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url: {
                                type: 'string',
                                description: 'The URL to extract metadata from',
                            },
                            useCache: {
                                type: 'boolean',
                                description: 'Whether to use cached content if available (default: true)',
                                default: true,
                            },
                        },
                        required: ['url'],
                    },
                },
                {
                    name: 'check_url_status',
                    description: 'Check if URL is accessible and get HTTP status codes',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url: {
                                type: 'string',
                                description: 'The URL to check status for',
                            },
                            followRedirects: {
                                type: 'boolean',
                                description: 'Whether to follow redirects (default: true)',
                                default: true,
                            },
                        },
                        required: ['url'],
                    },
                },
                {
                    name: 'extract_links',
                    description: 'Extract all links from a web page with filtering options',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url: {
                                type: 'string',
                                description: 'The URL to extract links from',
                            },
                            linkType: {
                                type: 'string',
                                enum: ['all', 'internal', 'external'],
                                description: 'Type of links to extract (default: all)',
                                default: 'all',
                            },
                            includeAnchorText: {
                                type: 'boolean',
                                description: 'Whether to include anchor text (default: true)',
                                default: true,
                            },
                            useCache: {
                                type: 'boolean',
                                description: 'Whether to use cached content if available (default: true)',
                                default: true,
                            },
                        },
                        required: ['url'],
                    },
                },
                {
                    name: 'extract_images',
                    description: 'Extract all images from a web page with metadata',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url: {
                                type: 'string',
                                description: 'The URL to extract images from',
                            },
                            includeAltText: {
                                type: 'boolean',
                                description: 'Whether to include alt text (default: true)',
                                default: true,
                            },
                            includeDimensions: {
                                type: 'boolean',
                                description: 'Whether to include image dimensions if available (default: false)',
                                default: false,
                            },
                            useCache: {
                                type: 'boolean',
                                description: 'Whether to use cached content if available (default: true)',
                                default: true,
                            },
                        },
                        required: ['url'],
                    },
                },
                {
                    name: 'search_content',
                    description: 'Search for specific text patterns within extracted content',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            content: {
                                type: 'string',
                                description: 'The content to search within',
                            },
                            query: {
                                type: 'string',
                                description: 'The search query or pattern',
                            },
                            caseSensitive: {
                                type: 'boolean',
                                description: 'Whether search should be case sensitive (default: false)',
                                default: false,
                            },
                            useRegex: {
                                type: 'boolean',
                                description: 'Whether to treat query as regex pattern (default: false)',
                                default: false,
                            },
                            maxResults: {
                                type: 'number',
                                description: 'Maximum number of results to return (default: 10)',
                                default: 10,
                            },
                        },
                        required: ['content', 'query'],
                    },
                },
                {
                    name: 'get_cache_stats',
                    description: 'Get detailed cache statistics and usage information',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            includeEntries: {
                                type: 'boolean',
                                description: 'Whether to include list of cached entries (default: false)',
                                default: false,
                            },
                        },
                        required: [],
                    },
                },
                {
                    name: 'validate_robots',
                    description: 'Check robots.txt compliance for specific URLs',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url: {
                                type: 'string',
                                description: 'The URL to check robots.txt compliance for',
                            },
                            userAgent: {
                                type: 'string',
                                description: 'User agent to check against (default: *)',
                                default: '*',
                            },
                        },
                        required: ['url'],
                    },
                },
                {
                    name: 'extract_structured_data',
                    description: 'Extract JSON-LD, microdata, and schema.org data',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url: {
                                type: 'string',
                                description: 'The URL to extract structured data from',
                            },
                            dataTypes: {
                                type: 'array',
                                items: {
                                    type: 'string',
                                    enum: ['json-ld', 'microdata', 'rdfa', 'opengraph'],
                                },
                                description: 'Types of structured data to extract (default: all)',
                                default: ['json-ld', 'microdata', 'rdfa', 'opengraph'],
                            },
                            useCache: {
                                type: 'boolean',
                                description: 'Whether to use cached content if available (default: true)',
                                default: true,
                            },
                        },
                        required: ['url'],
                    },
                },
                {
                    name: 'compare_content',
                    description: 'Compare content between two URLs or cached versions',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url1: {
                                type: 'string',
                                description: 'First URL to compare',
                            },
                            url2: {
                                type: 'string',
                                description: 'Second URL to compare',
                            },
                            compareType: {
                                type: 'string',
                                enum: ['text', 'structure', 'metadata'],
                                description: 'Type of comparison to perform (default: text)',
                                default: 'text',
                            },
                            useCache: {
                                type: 'boolean',
                                description: 'Whether to use cached content if available (default: true)',
                                default: true,
                            },
                        },
                        required: ['url1', 'url2'],
                    },
                },
                {
                    name: 'batch_extract',
                    description: 'Extract content from multiple URLs in a single operation',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            urls: {
                                type: 'array',
                                items: {
                                    type: 'string',
                                },
                                description: 'Array of URLs to extract content from',
                            },
                            format: {
                                type: 'string',
                                enum: ['markdown', 'text', 'json'],
                                description: 'Output format (default: markdown)',
                                default: 'markdown',
                            },
                            maxConcurrent: {
                                type: 'number',
                                description: 'Maximum concurrent requests (default: 3)',
                                default: 3,
                            },
                            useCache: {
                                type: 'boolean',
                                description: 'Whether to use cached content if available (default: true)',
                                default: true,
                            },
                        },
                        required: ['urls'],
                    },
                },
            ],
        };
    });
    // List available resources (cached content)
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
        cache.getStats();
        const entries = cache.getAll();
        return {
            resources: entries.map((entry) => ({
                uri: `cache://${encodeURIComponent(entry.url)}`,
                name: entry.title || 'Untitled',
                description: `Cached content from ${entry.url} (${new Date(entry.timestamp).toLocaleString()})`,
                mimeType: 'text/markdown',
            })),
        };
    });
    // Read cached content resource
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        const { uri } = request.params;
        if (!uri.startsWith('cache://')) {
            throw new McpError(ErrorCode.InvalidRequest, `Unsupported URI scheme: ${uri}`);
        }
        const url = decodeURIComponent(uri.replace('cache://', ''));
        const entry = cache.get(url);
        if (!entry) {
            throw new McpError(ErrorCode.InvalidRequest, `No cached content found for URL: ${url}`);
        }
        // Extract content to get proper formatting
        const extracted = extractContent(entry.content, entry.url);
        return {
            contents: [
                {
                    uri,
                    mimeType: 'text/markdown',
                    text: `${extracted.citation}\n\n${extracted.content}`,
                },
            ],
        };
    });
    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        try {
            switch (name) {
                case 'extract_content': {
                    const { url, format = 'markdown', includeImages = true, includeLinks = true, bypassRobots = false, useCache = true, } = args;
                    if (!url || typeof url !== 'string') {
                        throw new McpError(ErrorCode.InvalidParams, 'URL parameter is required and must be a string');
                    }
                    // Fetch content
                    const fetchResult = await fetchUrl(url, {
                        bypassRobots,
                        forceRefresh: !useCache,
                    });
                    // Extract and format content
                    const extracted = extractContent(fetchResult.content, fetchResult.url, {
                        format,
                        includeImages,
                        includeLinks,
                    });
                    // Update cache with extracted title
                    if (!fetchResult.fromCache) {
                        const cacheEntry = cache.get(fetchResult.url);
                        if (cacheEntry) {
                            cacheEntry.title = extracted.title;
                            cache.set(cacheEntry);
                        }
                    }
                    const result = {
                        title: extracted.title,
                        author: extracted.author,
                        content: extracted.content,
                        citation: extracted.citation,
                        url: extracted.url,
                        wordCount: extracted.wordCount,
                        fromCache: fetchResult.fromCache,
                        cacheHit: fetchResult.cacheHit,
                        timestamp: extracted.timestamp,
                    };
                    return {
                        content: [
                            {
                                type: 'text',
                                text: format === 'json'
                                    ? JSON.stringify(result, null, 2)
                                    : `${extracted.citation}\n\n${extracted.content}`,
                            },
                        ],
                    };
                }
                case 'summarize_content': {
                    const { content, maxLength = 500, format = 'paragraph', } = args;
                    if (!content || typeof content !== 'string') {
                        throw new McpError(ErrorCode.InvalidParams, 'Content parameter is required and must be a string');
                    }
                    const summary = summarizeContent(content, maxLength, format);
                    return {
                        content: [
                            {
                                type: 'text',
                                text: summary,
                            },
                        ],
                    };
                }
                case 'clear_cache': {
                    const { url } = args;
                    if (url) {
                        const deleted = cache.delete(url);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: deleted
                                        ? `Cleared cache entry for: ${url}`
                                        : `No cache entry found for: ${url}`,
                                },
                            ],
                        };
                    }
                    else {
                        const stats = cache.getStats();
                        cache.clear();
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Cleared ${stats.totalEntries} cache entries`,
                                },
                            ],
                        };
                    }
                }
                case 'get_page_metadata': {
                    const { url, useCache = true } = args;
                    if (!url || typeof url !== 'string') {
                        throw new McpError(ErrorCode.InvalidParams, 'URL parameter is required and must be a string');
                    }
                    const fetchResult = await fetchUrl(url, {
                        forceRefresh: !useCache,
                    });
                    const extracted = extractContent(fetchResult.content, fetchResult.url);
                    // Parse HTML to extract metadata
                    const cheerio = await import('cheerio');
                    const $ = cheerio.load(fetchResult.content);
                    const metadata = {
                        title: $('title').text() || extracted.title,
                        description: $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '',
                        keywords: $('meta[name="keywords"]').attr('content') || '',
                        author: $('meta[name="author"]').attr('content') || extracted.author,
                        canonical: $('link[rel="canonical"]').attr('href') || '',
                        ogTitle: $('meta[property="og:title"]').attr('content') || '',
                        ogImage: $('meta[property="og:image"]').attr('content') || '',
                        ogUrl: $('meta[property="og:url"]').attr('content') || '',
                        twitterCard: $('meta[name="twitter:card"]').attr('content') || '',
                        viewport: $('meta[name="viewport"]').attr('content') || '',
                        robots: $('meta[name="robots"]').attr('content') || '',
                        language: $('html').attr('lang') || $('meta[http-equiv="content-language"]').attr('content') || '',
                        charset: $('meta[charset]').attr('charset') || $('meta[http-equiv="content-type"]').attr('content') || '',
                    };
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(metadata, null, 2),
                            },
                        ],
                    };
                }
                case 'check_url_status': {
                    const { url, followRedirects = true } = args;
                    if (!url || typeof url !== 'string') {
                        throw new McpError(ErrorCode.InvalidParams, 'URL parameter is required and must be a string');
                    }
                    try {
                        const response = await fetch(url, {
                            method: 'HEAD',
                            redirect: followRedirects ? 'follow' : 'manual',
                            headers: {
                                'User-Agent': 'mcp-web-scrape/1.0.0',
                            },
                        });
                        const statusInfo = {
                            url,
                            status: response.status,
                            statusText: response.statusText,
                            ok: response.ok,
                            redirected: response.redirected,
                            finalUrl: response.url,
                            headers: Object.fromEntries(response.headers.entries()),
                            contentType: response.headers.get('content-type') || '',
                            contentLength: response.headers.get('content-length') || '',
                            lastModified: response.headers.get('last-modified') || '',
                        };
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(statusInfo, null, 2),
                                },
                            ],
                        };
                    }
                    catch (error) {
                        const errorInfo = {
                            url,
                            error: error instanceof Error ? error.message : String(error),
                            accessible: false,
                        };
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(errorInfo, null, 2),
                                },
                            ],
                        };
                    }
                }
                case 'extract_links': {
                    const { url, linkType = 'all', includeAnchorText = true, useCache = true, } = args;
                    if (!url || typeof url !== 'string') {
                        throw new McpError(ErrorCode.InvalidParams, 'URL parameter is required and must be a string');
                    }
                    const fetchResult = await fetchUrl(url, {
                        forceRefresh: !useCache,
                    });
                    const cheerio = await import('cheerio');
                    const $ = cheerio.load(fetchResult.content);
                    const baseUrl = new URL(fetchResult.url);
                    const links = [];
                    $('a[href]').each((_, element) => {
                        const href = $(element).attr('href');
                        if (!href)
                            return;
                        try {
                            const absoluteUrl = new URL(href, baseUrl.origin).href;
                            const isInternal = new URL(absoluteUrl).hostname === baseUrl.hostname;
                            const type = isInternal ? 'internal' : 'external';
                            if (linkType === 'all' || linkType === type) {
                                const link = {
                                    href: absoluteUrl,
                                    type,
                                };
                                if (includeAnchorText) {
                                    link.text = $(element).text().trim();
                                    link.title = $(element).attr('title') || '';
                                }
                                links.push(link);
                            }
                        }
                        catch {
                            // Skip invalid URLs
                        }
                    });
                    const result = {
                        url: fetchResult.url,
                        totalLinks: links.length,
                        linkType,
                        links,
                    };
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(result, null, 2),
                            },
                        ],
                    };
                }
                case 'extract_images': {
                    const { url, includeAltText = true, includeDimensions = false, useCache = true, } = args;
                    if (!url || typeof url !== 'string') {
                        throw new McpError(ErrorCode.InvalidParams, 'URL parameter is required and must be a string');
                    }
                    const fetchResult = await fetchUrl(url, {
                        forceRefresh: !useCache,
                    });
                    const cheerio = await import('cheerio');
                    const $ = cheerio.load(fetchResult.content);
                    const baseUrl = new URL(fetchResult.url);
                    const images = [];
                    $('img[src]').each((_, element) => {
                        const src = $(element).attr('src');
                        if (!src)
                            return;
                        try {
                            const absoluteUrl = new URL(src, baseUrl.origin).href;
                            const image = {
                                src: absoluteUrl,
                            };
                            if (includeAltText) {
                                image.alt = $(element).attr('alt') || '';
                                image.title = $(element).attr('title') || '';
                            }
                            if (includeDimensions) {
                                image.width = $(element).attr('width') || '';
                                image.height = $(element).attr('height') || '';
                            }
                            images.push(image);
                        }
                        catch {
                            // Skip invalid URLs
                        }
                    });
                    const result = {
                        url: fetchResult.url,
                        totalImages: images.length,
                        images,
                    };
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(result, null, 2),
                            },
                        ],
                    };
                }
                case 'search_content': {
                    const { content, query, caseSensitive = false, useRegex = false, maxResults = 10, } = args;
                    if (!content || typeof content !== 'string') {
                        throw new McpError(ErrorCode.InvalidParams, 'Content parameter is required and must be a string');
                    }
                    if (!query || typeof query !== 'string') {
                        throw new McpError(ErrorCode.InvalidParams, 'Query parameter is required and must be a string');
                    }
                    const results = [];
                    try {
                        const lines = content.split('\n');
                        const searchPattern = useRegex
                            ? new RegExp(query, caseSensitive ? 'g' : 'gi')
                            : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi');
                        lines.forEach((line, lineIndex) => {
                            if (results.length >= maxResults)
                                return;
                            let match;
                            while ((match = searchPattern.exec(line)) !== null && results.length < maxResults) {
                                const contextStart = Math.max(0, match.index - 50);
                                const contextEnd = Math.min(line.length, match.index + match[0].length + 50);
                                const context = line.substring(contextStart, contextEnd);
                                results.push({
                                    match: match[0],
                                    context,
                                    position: match.index,
                                    line: lineIndex + 1,
                                });
                                if (!useRegex)
                                    break; // For non-regex, only find first match per line
                            }
                        });
                    }
                    catch (error) {
                        throw new McpError(ErrorCode.InvalidParams, `Invalid search pattern: ${error instanceof Error ? error.message : String(error)}`);
                    }
                    const searchResult = {
                        query,
                        totalMatches: results.length,
                        caseSensitive,
                        useRegex,
                        results,
                    };
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(searchResult, null, 2),
                            },
                        ],
                    };
                }
                case 'get_cache_stats': {
                    const { includeEntries = false } = args;
                    const stats = cache.getStats();
                    const result = {
                        totalEntries: stats.totalEntries,
                        totalSize: stats.totalSize,
                        oldestEntry: stats.oldestEntry,
                        newestEntry: stats.newestEntry,
                    };
                    if (includeEntries) {
                        result.entries = cache.getAll().map(entry => ({
                            url: entry.url,
                            title: entry.title,
                            size: entry.content.length,
                            timestamp: entry.timestamp,
                            age: Date.now() - entry.timestamp,
                        }));
                    }
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(result, null, 2),
                            },
                        ],
                    };
                }
                case 'validate_robots': {
                    const { url, userAgent = '*' } = args;
                    if (!url || typeof url !== 'string') {
                        throw new McpError(ErrorCode.InvalidParams, 'URL parameter is required and must be a string');
                    }
                    try {
                        const { checkRobots } = await import('./robots.js');
                        const robotsResult = await checkRobots(url, userAgent);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(robotsResult, null, 2),
                                },
                            ],
                        };
                    }
                    catch (error) {
                        const errorResult = {
                            url,
                            userAgent,
                            allowed: false,
                            error: error instanceof Error ? error.message : String(error),
                        };
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: JSON.stringify(errorResult, null, 2),
                                },
                            ],
                        };
                    }
                }
                case 'extract_structured_data': {
                    const { url, dataTypes = ['json-ld', 'microdata', 'rdfa', 'opengraph'], useCache = true, } = args;
                    if (!url || typeof url !== 'string') {
                        throw new McpError(ErrorCode.InvalidParams, 'URL parameter is required and must be a string');
                    }
                    const fetchResult = await fetchUrl(url, {
                        forceRefresh: !useCache,
                    });
                    const cheerio = await import('cheerio');
                    const $ = cheerio.load(fetchResult.content);
                    const structuredData = {
                        url: fetchResult.url,
                        extractedTypes: [],
                    };
                    // Extract JSON-LD
                    if (dataTypes.includes('json-ld')) {
                        const jsonLdScripts = [];
                        $('script[type="application/ld+json"]').each((_, element) => {
                            try {
                                const jsonData = JSON.parse($(element).html() || '');
                                jsonLdScripts.push(jsonData);
                            }
                            catch {
                                // Skip invalid JSON
                            }
                        });
                        if (jsonLdScripts.length > 0) {
                            structuredData['json-ld'] = jsonLdScripts;
                            structuredData.extractedTypes.push('json-ld');
                        }
                    }
                    // Extract OpenGraph
                    if (dataTypes.includes('opengraph')) {
                        const ogData = {};
                        $('meta[property^="og:"]').each((_, element) => {
                            const property = $(element).attr('property');
                            const content = $(element).attr('content');
                            if (property && content) {
                                ogData[property] = content;
                            }
                        });
                        if (Object.keys(ogData).length > 0) {
                            structuredData.opengraph = ogData;
                            structuredData.extractedTypes.push('opengraph');
                        }
                    }
                    // Extract Microdata (basic implementation)
                    if (dataTypes.includes('microdata')) {
                        const microdataItems = [];
                        $('[itemscope]').each((_, element) => {
                            const item = {};
                            const itemType = $(element).attr('itemtype');
                            if (itemType)
                                item.type = itemType;
                            const properties = {};
                            $(element).find('[itemprop]').each((_, propElement) => {
                                const prop = $(propElement).attr('itemprop');
                                const content = $(propElement).attr('content') || $(propElement).text().trim();
                                if (prop && content) {
                                    properties[prop] = content;
                                }
                            });
                            if (Object.keys(properties).length > 0) {
                                item.properties = properties;
                                microdataItems.push(item);
                            }
                        });
                        if (microdataItems.length > 0) {
                            structuredData.microdata = microdataItems;
                            structuredData.extractedTypes.push('microdata');
                        }
                    }
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(structuredData, null, 2),
                            },
                        ],
                    };
                }
                case 'compare_content': {
                    const { url1, url2, compareType = 'text', useCache = true, } = args;
                    if (!url1 || typeof url1 !== 'string') {
                        throw new McpError(ErrorCode.InvalidParams, 'url1 parameter is required and must be a string');
                    }
                    if (!url2 || typeof url2 !== 'string') {
                        throw new McpError(ErrorCode.InvalidParams, 'url2 parameter is required and must be a string');
                    }
                    const [fetchResult1, fetchResult2] = await Promise.all([
                        fetchUrl(url1, { forceRefresh: !useCache }),
                        fetchUrl(url2, { forceRefresh: !useCache }),
                    ]);
                    const extracted1 = extractContent(fetchResult1.content, fetchResult1.url);
                    const extracted2 = extractContent(fetchResult2.content, fetchResult2.url);
                    let comparison = {
                        url1: fetchResult1.url,
                        url2: fetchResult2.url,
                        compareType,
                    };
                    if (compareType === 'text') {
                        const content1 = extracted1.content;
                        const content2 = extracted2.content;
                        comparison.textComparison = {
                            length1: content1.length,
                            length2: content2.length,
                            lengthDifference: Math.abs(content1.length - content2.length),
                            similarity: calculateTextSimilarity(content1, content2),
                            identical: content1 === content2,
                        };
                    }
                    else if (compareType === 'metadata') {
                        comparison.metadataComparison = {
                            title1: extracted1.title,
                            title2: extracted2.title,
                            author1: extracted1.author,
                            author2: extracted2.author,
                            wordCount1: extracted1.wordCount,
                            wordCount2: extracted2.wordCount,
                            titleMatch: extracted1.title === extracted2.title,
                            authorMatch: extracted1.author === extracted2.author,
                        };
                    }
                    else if (compareType === 'structure') {
                        const cheerio = await import('cheerio');
                        const $1 = cheerio.load(fetchResult1.content);
                        const $2 = cheerio.load(fetchResult2.content);
                        const getStructure = ($) => {
                            const structure = {};
                            ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'section', 'article'].forEach(tag => {
                                structure[tag] = $(tag).length;
                            });
                            return structure;
                        };
                        comparison.structureComparison = {
                            structure1: getStructure($1),
                            structure2: getStructure($2),
                        };
                    }
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(comparison, null, 2),
                            },
                        ],
                    };
                }
                case 'batch_extract': {
                    const { urls, format = 'markdown', maxConcurrent = 3, useCache = true, } = args;
                    if (!Array.isArray(urls) || urls.length === 0) {
                        throw new McpError(ErrorCode.InvalidParams, 'urls parameter is required and must be a non-empty array');
                    }
                    if (urls.some(url => typeof url !== 'string')) {
                        throw new McpError(ErrorCode.InvalidParams, 'All URLs must be strings');
                    }
                    if (urls.length > 20) {
                        throw new McpError(ErrorCode.InvalidParams, 'Maximum 20 URLs allowed per batch');
                    }
                    const results = [];
                    const errors = [];
                    // Process URLs in batches to respect concurrency limit
                    for (let i = 0; i < urls.length; i += maxConcurrent) {
                        const batch = urls.slice(i, i + maxConcurrent);
                        const batchPromises = batch.map(async (url) => {
                            try {
                                const fetchResult = await fetchUrl(url, {
                                    forceRefresh: !useCache,
                                });
                                const extracted = extractContent(fetchResult.content, fetchResult.url, {
                                    format,
                                });
                                return {
                                    url: fetchResult.url,
                                    success: true,
                                    title: extracted.title,
                                    content: extracted.content,
                                    wordCount: extracted.wordCount,
                                    fromCache: fetchResult.fromCache,
                                };
                            }
                            catch (error) {
                                return {
                                    url,
                                    success: false,
                                    error: error instanceof Error ? error.message : String(error),
                                };
                            }
                        });
                        const batchResults = await Promise.all(batchPromises);
                        batchResults.forEach(result => {
                            if (result.success) {
                                results.push(result);
                            }
                            else {
                                errors.push(result);
                            }
                        });
                    }
                    const batchResult = {
                        totalRequested: urls.length,
                        successful: results.length,
                        failed: errors.length,
                        format,
                        results,
                        errors,
                    };
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(batchResult, null, 2),
                            },
                        ],
                    };
                }
                default:
                    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
            }
        }
        catch (error) {
            if (error instanceof McpError) {
                throw error;
            }
            // Handle other errors
            const message = error instanceof Error ? error.message : String(error);
            throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${message}`);
        }
    });
    return server;
}
//# sourceMappingURL=server.js.map