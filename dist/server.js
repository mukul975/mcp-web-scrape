/**
 * MCP Web Scrape Server
 * Implements the Model Context Protocol for web content extraction
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ErrorCode, ListResourcesRequestSchema, ListToolsRequestSchema, McpError, ReadResourceRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { fetchUrl } from './fetch.js';
import { extractContent, summarizeContent } from './extract.js';
import { cache } from './cache.js';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
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
                {
                    name: 'extract_forms',
                    description: 'Extract form elements and their structure from web pages',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url: {
                                type: 'string',
                                description: 'The URL to extract forms from',
                            },
                            includeHidden: {
                                type: 'boolean',
                                description: 'Whether to include hidden form fields (default: false)',
                                default: false,
                            },
                            includeDisabled: {
                                type: 'boolean',
                                description: 'Whether to include disabled form fields (default: false)',
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
                    name: 'extract_tables',
                    description: 'Extract and parse HTML tables with optional CSV export',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url: {
                                type: 'string',
                                description: 'The URL to extract tables from',
                            },
                            format: {
                                type: 'string',
                                enum: ['json', 'csv', 'markdown'],
                                description: 'Output format for tables (default: json)',
                                default: 'json',
                            },
                            includeHeaders: {
                                type: 'boolean',
                                description: 'Whether to include table headers (default: true)',
                                default: true,
                            },
                            minRows: {
                                type: 'number',
                                description: 'Minimum number of rows to include table (default: 1)',
                                default: 1,
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
                    name: 'extract_social_media',
                    description: 'Extract social media links and metadata from web pages',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url: {
                                type: 'string',
                                description: 'The URL to extract social media links from',
                            },
                            platforms: {
                                type: 'array',
                                items: {
                                    type: 'string',
                                    enum: ['twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'all'],
                                },
                                description: 'Social media platforms to extract (default: all)',
                                default: ['all'],
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
                    name: 'extract_contact_info',
                    description: 'Extract contact information like emails, phones, addresses from web pages',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url: {
                                type: 'string',
                                description: 'The URL to extract contact information from',
                            },
                            types: {
                                type: 'array',
                                items: {
                                    type: 'string',
                                    enum: ['email', 'phone', 'address', 'all'],
                                },
                                description: 'Types of contact information to extract (default: all)',
                                default: ['all'],
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
                    name: 'extract_headings',
                    description: 'Extract document structure and heading hierarchy from web pages',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url: {
                                type: 'string',
                                description: 'The URL to extract headings from',
                            },
                            levels: {
                                type: 'array',
                                items: {
                                    type: 'number',
                                    minimum: 1,
                                    maximum: 6,
                                },
                                description: 'Heading levels to extract (1-6, default: all)',
                                default: [1, 2, 3, 4, 5, 6],
                            },
                            includeText: {
                                type: 'boolean',
                                description: 'Whether to include heading text content (default: true)',
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
                    name: 'extract_feeds',
                    description: 'Discover and parse RSS/Atom feeds from web pages',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url: {
                                type: 'string',
                                description: 'The URL to discover feeds from',
                            },
                            maxItems: {
                                type: 'number',
                                description: 'Maximum number of feed items to return (default: 10)',
                                default: 10,
                            },
                            includeContent: {
                                type: 'boolean',
                                description: 'Whether to include full content of feed items (default: false)',
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
                    name: 'monitor_changes',
                    description: 'Monitor web page content changes over time',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url: {
                                type: 'string',
                                description: 'The URL to monitor for changes',
                            },
                            interval: {
                                type: 'number',
                                description: 'Check interval in seconds (default: 3600)',
                                default: 3600,
                            },
                            threshold: {
                                type: 'number',
                                description: 'Change detection threshold 0-1 (default: 0.1)',
                                default: 0.1,
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
                    name: 'analyze_performance',
                    description: 'Analyze web page performance metrics',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url: {
                                type: 'string',
                                description: 'The URL to analyze performance for',
                            },
                            metrics: {
                                type: 'array',
                                items: {
                                    type: 'string',
                                    enum: ['size', 'resources', 'seo', 'accessibility', 'all'],
                                },
                                description: 'Performance metrics to analyze (default: all)',
                                default: ['all'],
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
                    name: 'generate_sitemap',
                    description: 'Generate sitemap by crawling website pages',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url: {
                                type: 'string',
                                description: 'The base URL to start crawling from',
                            },
                            maxDepth: {
                                type: 'number',
                                description: 'Maximum crawl depth (default: 2)',
                                default: 2,
                            },
                            maxPages: {
                                type: 'number',
                                description: 'Maximum number of pages to crawl (default: 50)',
                                default: 50,
                            },
                            includeExternal: {
                                type: 'boolean',
                                description: 'Whether to include external links (default: false)',
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
                    name: 'validate_html',
                    description: 'Validate HTML structure, accessibility, and SEO',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url: {
                                type: 'string',
                                description: 'The URL to validate',
                            },
                            checks: {
                                type: 'array',
                                items: {
                                    type: 'string',
                                    enum: ['structure', 'accessibility', 'seo', 'performance', 'all'],
                                },
                                description: 'Validation checks to perform (default: all)',
                                default: ['all'],
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
                case 'extract_forms': {
                    const { url, includeHidden = false, includeDisabled = false, useCache = true, } = args;
                    if (!url || typeof url !== 'string') {
                        throw new McpError(ErrorCode.InvalidParams, 'URL parameter is required and must be a string');
                    }
                    const fetchResult = await fetchUrl(url, {
                        forceRefresh: !useCache,
                    });
                    const $ = cheerio.load(fetchResult.content);
                    const forms = [];
                    $('form').each((_, formElement) => {
                        const form = {
                            action: $(formElement).attr('action') || '',
                            method: $(formElement).attr('method') || 'GET',
                            enctype: $(formElement).attr('enctype') || 'application/x-www-form-urlencoded',
                            name: $(formElement).attr('name') || '',
                            id: $(formElement).attr('id') || '',
                            fields: [],
                        };
                        // Extract form fields
                        $(formElement).find('input, textarea, select').each((_, fieldElement) => {
                            const field = {
                                type: $(fieldElement).attr('type') || $(fieldElement).prop('tagName')?.toLowerCase(),
                                name: $(fieldElement).attr('name') || '',
                                id: $(fieldElement).attr('id') || '',
                                value: $(fieldElement).attr('value') || $(fieldElement).text(),
                                placeholder: $(fieldElement).attr('placeholder') || '',
                                required: $(fieldElement).attr('required') !== undefined,
                                disabled: $(fieldElement).attr('disabled') !== undefined,
                                hidden: $(fieldElement).attr('type') === 'hidden',
                            };
                            // Add label if available
                            if (field.id) {
                                const label = $(formElement).find(`label[for="${field.id}"]`).text().trim();
                                if (label)
                                    field.label = label;
                            }
                            // Filter based on options
                            if (!includeHidden && field.hidden)
                                return;
                            if (!includeDisabled && field.disabled)
                                return;
                            // Handle select options
                            if ($(fieldElement).prop('tagName')?.toLowerCase() === 'select') {
                                field.options = [];
                                $(fieldElement).find('option').each((_, optionElement) => {
                                    field.options.push({
                                        value: $(optionElement).attr('value') || '',
                                        text: $(optionElement).text().trim(),
                                        selected: $(optionElement).attr('selected') !== undefined,
                                    });
                                });
                            }
                            form.fields.push(field);
                        });
                        forms.push(form);
                    });
                    const result = {
                        url: fetchResult.url,
                        formsFound: forms.length,
                        forms,
                        fromCache: fetchResult.fromCache,
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
                case 'extract_tables': {
                    const { url, format = 'json', includeHeaders = true, minRows = 1, useCache = true, } = args;
                    if (!url || typeof url !== 'string') {
                        throw new McpError(ErrorCode.InvalidParams, 'URL parameter is required and must be a string');
                    }
                    const fetchResult = await fetchUrl(url, {
                        forceRefresh: !useCache,
                    });
                    const $ = cheerio.load(fetchResult.content);
                    const tables = [];
                    $('table').each((tableIndex, tableElement) => {
                        const rows = [];
                        let headers = [];
                        // Extract headers
                        if (includeHeaders) {
                            $(tableElement).find('thead tr, tr:first-child').first().find('th, td').each((_, headerElement) => {
                                headers.push($(headerElement).text().trim());
                            });
                        }
                        // Extract data rows
                        const dataRows = includeHeaders
                            ? $(tableElement).find('tbody tr, tr:not(:first-child)')
                            : $(tableElement).find('tr');
                        dataRows.each((_, rowElement) => {
                            const row = [];
                            $(rowElement).find('td, th').each((_, cellElement) => {
                                row.push($(cellElement).text().trim());
                            });
                            if (row.length > 0)
                                rows.push(row);
                        });
                        // Filter by minimum rows
                        if (rows.length >= minRows) {
                            const table = {
                                index: tableIndex,
                                headers: headers.length > 0 ? headers : null,
                                rows,
                                rowCount: rows.length,
                                columnCount: Math.max(headers.length, ...rows.map(r => r.length)),
                            };
                            // Format output
                            if (format === 'csv') {
                                let csvContent = '';
                                if (headers.length > 0) {
                                    csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',') + '\n';
                                }
                                csvContent += rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
                                table.csv = csvContent;
                            }
                            else if (format === 'markdown') {
                                let mdContent = '';
                                if (headers.length > 0) {
                                    mdContent += '| ' + headers.join(' | ') + ' |\n';
                                    mdContent += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
                                }
                                mdContent += rows.map(row => '| ' + row.join(' | ') + ' |').join('\n');
                                table.markdown = mdContent;
                            }
                            tables.push(table);
                        }
                    });
                    const result = {
                        url: fetchResult.url,
                        tablesFound: tables.length,
                        format,
                        tables,
                        fromCache: fetchResult.fromCache,
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
                case 'extract_social_media': {
                    const { url, platforms = ['all'], useCache = true, } = args;
                    if (!url || typeof url !== 'string') {
                        throw new McpError(ErrorCode.InvalidParams, 'URL parameter is required and must be a string');
                    }
                    const fetchResult = await fetchUrl(url, {
                        forceRefresh: !useCache,
                    });
                    const $ = cheerio.load(fetchResult.content);
                    const socialLinks = {};
                    const platformPatterns = {
                        twitter: /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/,
                        facebook: /facebook\.com\/([a-zA-Z0-9._]+)/,
                        instagram: /instagram\.com\/([a-zA-Z0-9._]+)/,
                        linkedin: /linkedin\.com\/(?:in|company)\/([a-zA-Z0-9-]+)/,
                        youtube: /youtube\.com\/(?:channel\/|user\/|c\/)?([a-zA-Z0-9_-]+)/,
                        tiktok: /tiktok\.com\/@([a-zA-Z0-9._]+)/,
                    };
                    const shouldExtract = (platform) => platforms.includes('all') || platforms.includes(platform);
                    // Extract from links
                    $('a[href]').each((_, linkElement) => {
                        const href = $(linkElement).attr('href') || '';
                        const text = $(linkElement).text().trim();
                        Object.entries(platformPatterns).forEach(([platform, pattern]) => {
                            if (shouldExtract(platform) && pattern.test(href)) {
                                if (!socialLinks[platform])
                                    socialLinks[platform] = [];
                                const match = href.match(pattern);
                                socialLinks[platform].push({
                                    url: href,
                                    username: match ? match[1] : '',
                                    linkText: text,
                                });
                            }
                        });
                    });
                    // Extract from meta tags
                    const metaSocial = {};
                    $('meta[property^="og:"], meta[name^="twitter:"]').each((_, metaElement) => {
                        const property = $(metaElement).attr('property') || $(metaElement).attr('name') || '';
                        const content = $(metaElement).attr('content') || '';
                        if (property && content) {
                            metaSocial[property] = content;
                        }
                    });
                    const result = {
                        url: fetchResult.url,
                        socialLinks,
                        metaTags: metaSocial,
                        platformsFound: Object.keys(socialLinks),
                        fromCache: fetchResult.fromCache,
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
                case 'extract_contact_info': {
                    const { url, types = ['all'], useCache = true, } = args;
                    if (!url || typeof url !== 'string') {
                        throw new McpError(ErrorCode.InvalidParams, 'URL parameter is required and must be a string');
                    }
                    const fetchResult = await fetchUrl(url, {
                        forceRefresh: !useCache,
                    });
                    const $ = cheerio.load(fetchResult.content);
                    const contactInfo = {};
                    const shouldExtract = (type) => types.includes('all') || types.includes(type);
                    // Extract emails
                    if (shouldExtract('email')) {
                        const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
                        const pageText = $.text();
                        const emails = [...new Set(pageText.match(emailPattern) || [])];
                        // Also check mailto links
                        const mailtoEmails = [];
                        $('a[href^="mailto:"]').each((_, linkElement) => {
                            const href = $(linkElement).attr('href') || '';
                            const email = href.replace('mailto:', '').split('?')[0];
                            if (email)
                                mailtoEmails.push(email);
                        });
                        contactInfo.emails = [...new Set([...emails, ...mailtoEmails])];
                    }
                    // Extract phone numbers
                    if (shouldExtract('phone')) {
                        const phonePattern = /(?:\+?1[-\s]?)?\(?[0-9]{3}\)?[-\s]?[0-9]{3}[-\s]?[0-9]{4}/g;
                        const pageText = $.text();
                        const phones = [...new Set(pageText.match(phonePattern) || [])];
                        // Also check tel links
                        const telPhones = [];
                        $('a[href^="tel:"]').each((_, linkElement) => {
                            const href = $(linkElement).attr('href') || '';
                            const phone = href.replace('tel:', '');
                            if (phone)
                                telPhones.push(phone);
                        });
                        contactInfo.phones = [...new Set([...phones, ...telPhones])];
                    }
                    // Extract addresses (basic implementation)
                    if (shouldExtract('address')) {
                        const addresses = [];
                        // Look for address-like patterns
                        $('[class*="address"], [id*="address"], address').each((_, element) => {
                            const text = $(element).text().trim();
                            if (text.length > 10)
                                addresses.push(text);
                        });
                        // Look for structured data addresses
                        $('[itemtype*="PostalAddress"], [typeof*="PostalAddress"]').each((_, element) => {
                            const text = $(element).text().trim();
                            if (text.length > 10)
                                addresses.push(text);
                        });
                        contactInfo.addresses = [...new Set(addresses)];
                    }
                    const result = {
                        url: fetchResult.url,
                        contactInfo,
                        typesExtracted: Object.keys(contactInfo),
                        fromCache: fetchResult.fromCache,
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
                case 'extract_headings': {
                    const { url, levels = [1, 2, 3, 4, 5, 6], includeText = true, useCache = true, } = args;
                    if (!url || typeof url !== 'string') {
                        throw new McpError(ErrorCode.InvalidParams, 'URL parameter is required and must be a string');
                    }
                    const fetchResult = await fetchUrl(url, {
                        forceRefresh: !useCache,
                    });
                    const $ = cheerio.load(fetchResult.content);
                    const headings = [];
                    levels.forEach(level => {
                        $(`h${level}`).each((index, element) => {
                            const heading = {
                                level,
                                tag: `h${level}`,
                                index,
                                id: $(element).attr('id') || '',
                                class: $(element).attr('class') || '',
                            };
                            if (includeText) {
                                heading.text = $(element).text().trim();
                                heading.html = $(element).html();
                            }
                            headings.push(heading);
                        });
                    });
                    // Sort by document order
                    headings.sort((a, b) => {
                        if (a.level !== b.level)
                            return a.level - b.level;
                        return a.index - b.index;
                    });
                    const result = {
                        url: fetchResult.url,
                        headingsFound: headings.length,
                        levels: [...new Set(headings.map(h => h.level))].sort(),
                        headings,
                        structure: levels.map(level => ({
                            level,
                            count: headings.filter(h => h.level === level).length,
                        })),
                        fromCache: fetchResult.fromCache,
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
                case 'extract_feeds': {
                    const { url, maxItems = 10, includeContent = false, useCache = true, } = args;
                    if (!url || typeof url !== 'string') {
                        throw new McpError(ErrorCode.InvalidParams, 'URL parameter is required and must be a string');
                    }
                    const fetchResult = await fetchUrl(url, {
                        forceRefresh: !useCache,
                    });
                    const $ = cheerio.load(fetchResult.content);
                    const feeds = [];
                    // Discover feed links
                    const feedLinks = [];
                    $('link[type="application/rss+xml"], link[type="application/atom+xml"]').each((_, element) => {
                        const href = $(element).attr('href');
                        if (href) {
                            const feedUrl = new URL(href, fetchResult.url).toString();
                            feedLinks.push(feedUrl);
                        }
                    });
                    // Also check for common feed URLs
                    const commonFeeds = ['/rss', '/feed', '/atom.xml', '/rss.xml', '/feed.xml'];
                    for (const feedPath of commonFeeds) {
                        try {
                            const feedUrl = new URL(feedPath, fetchResult.url).toString();
                            feedLinks.push(feedUrl);
                        }
                        catch {
                            // Skip invalid URLs
                        }
                    }
                    // Fetch and parse feeds
                    for (const feedUrl of [...new Set(feedLinks)]) {
                        try {
                            const feedResult = await fetchUrl(feedUrl, { forceRefresh: !useCache });
                            const feed$ = cheerio.load(feedResult.content, { xmlMode: true });
                            const feedData = {
                                url: feedUrl,
                                type: feedResult.content.includes('<rss') ? 'RSS' : 'Atom',
                                title: feed$('channel > title, feed > title').first().text().trim(),
                                description: feed$('channel > description, feed > subtitle').first().text().trim(),
                                link: feed$('channel > link, feed > link[rel="alternate"]').first().attr('href') || feed$('channel > link, feed > link').first().text().trim(),
                                items: [],
                            };
                            // Extract items
                            const items = feed$('item, entry').slice(0, maxItems);
                            items.each((_, itemElement) => {
                                const item = {
                                    title: feed$(itemElement).find('title').first().text().trim(),
                                    link: feed$(itemElement).find('link').first().attr('href') || feed$(itemElement).find('link').first().text().trim(),
                                    description: feed$(itemElement).find('description, summary').first().text().trim(),
                                    pubDate: feed$(itemElement).find('pubDate, published').first().text().trim(),
                                    author: feed$(itemElement).find('author, dc\\:creator').first().text().trim(),
                                };
                                if (includeContent) {
                                    item.content = feed$(itemElement).find('content\\:encoded, content').first().text().trim();
                                }
                                feedData.items.push(item);
                            });
                            feeds.push(feedData);
                        }
                        catch {
                            // Skip feeds that can't be parsed
                        }
                    }
                    const result = {
                        url: fetchResult.url,
                        feedsFound: feeds.length,
                        feeds,
                        fromCache: fetchResult.fromCache,
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
                case 'monitor_changes': {
                    const { url, interval = 3600, threshold = 0.1, useCache = true, } = args;
                    if (!url || typeof url !== 'string') {
                        throw new McpError(ErrorCode.InvalidParams, 'URL parameter is required and must be a string');
                    }
                    const fetchResult = await fetchUrl(url, {
                        forceRefresh: !useCache,
                    });
                    const $ = cheerio.load(fetchResult.content);
                    const currentContent = $.text().trim();
                    const currentHash = createHash('md5').update(currentContent).digest('hex');
                    // Store monitoring data (in a real implementation, this would be persisted)
                    const monitoringKey = `monitor_${Buffer.from(url).toString('base64')}`;
                    const previousData = cache.get(monitoringKey);
                    const result = {
                        url: fetchResult.url,
                        currentHash,
                        timestamp: new Date().toISOString(),
                        contentLength: currentContent.length,
                        monitoring: {
                            interval,
                            threshold,
                        },
                    };
                    if (previousData) {
                        const similarity = calculateTextSimilarity(previousData.content, currentContent);
                        const changeDetected = similarity < (1 - threshold);
                        result.previousHash = previousData.hash;
                        result.similarity = similarity;
                        result.changeDetected = changeDetected;
                        result.lastChecked = previousData.timestamp;
                        result.changePercentage = Math.round((1 - similarity) * 100 * 100) / 100;
                        if (changeDetected) {
                            result.changes = {
                                contentLengthDiff: currentContent.length - previousData.contentLength,
                                timeSinceLastChange: new Date().getTime() - new Date(previousData.timestamp).getTime(),
                            };
                        }
                    }
                    else {
                        result.isFirstCheck = true;
                    }
                    // Update cache with current data
                    cache.set({
                        url: monitoringKey,
                        content: currentContent,
                        title: 'Monitoring Data',
                        timestamp: Date.now(),
                        size: currentContent.length,
                    });
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(result, null, 2),
                            },
                        ],
                    };
                }
                case 'analyze_performance': {
                    const { url, metrics = ['all'], useCache = true, } = args;
                    if (!url || typeof url !== 'string') {
                        throw new McpError(ErrorCode.InvalidParams, 'URL parameter is required and must be a string');
                    }
                    const startTime = Date.now();
                    const fetchResult = await fetchUrl(url, {
                        forceRefresh: !useCache,
                    });
                    const endTime = Date.now();
                    const $ = cheerio.load(fetchResult.content);
                    const shouldAnalyze = (metric) => metrics.includes('all') || metrics.includes(metric);
                    const performance = {
                        url: fetchResult.url,
                        timestamp: new Date().toISOString(),
                        loadTime: endTime - startTime,
                    };
                    if (shouldAnalyze('size')) {
                        performance.size = {
                            html: fetchResult.content.length,
                            htmlFormatted: `${Math.round(fetchResult.content.length / 1024 * 100) / 100} KB`,
                            compressed: Buffer.byteLength(fetchResult.content, 'utf8'),
                        };
                    }
                    if (shouldAnalyze('resources')) {
                        const resources = {
                            images: $('img').length,
                            scripts: $('script').length,
                            stylesheets: $('link[rel="stylesheet"]').length,
                            links: $('a').length,
                            forms: $('form').length,
                        };
                        performance.resources = resources;
                        performance.totalResources = Object.values(resources).reduce((a, b) => a + b, 0);
                    }
                    if (shouldAnalyze('seo')) {
                        performance.seo = {
                            title: $('title').text().trim(),
                            titleLength: $('title').text().trim().length,
                            metaDescription: $('meta[name="description"]').attr('content') || '',
                            metaDescriptionLength: ($('meta[name="description"]').attr('content') || '').length,
                            h1Count: $('h1').length,
                            h2Count: $('h2').length,
                            altTextMissing: $('img:not([alt])').length,
                            internalLinks: $('a[href^="/"], a[href*="' + new URL(url).hostname + '"]').length,
                            externalLinks: $('a[href^="http"]:not([href*="' + new URL(url).hostname + '"])').length,
                        };
                    }
                    if (shouldAnalyze('accessibility')) {
                        performance.accessibility = {
                            missingAltText: $('img:not([alt])').length,
                            emptyAltText: $('img[alt=""]').length,
                            missingLabels: $('input:not([aria-label]):not([aria-labelledby])').filter((_, el) => {
                                const id = $(el).attr('id');
                                return !id || !$(`label[for="${id}"]`).length;
                            }).length,
                            headingStructure: {
                                h1: $('h1').length,
                                h2: $('h2').length,
                                h3: $('h3').length,
                                h4: $('h4').length,
                                h5: $('h5').length,
                                h6: $('h6').length,
                            },
                        };
                    }
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(performance, null, 2),
                            },
                        ],
                    };
                }
                case 'generate_sitemap': {
                    const { url, maxDepth = 2, maxPages = 50, includeExternal = false, useCache = true, } = args;
                    if (!url || typeof url !== 'string') {
                        throw new McpError(ErrorCode.InvalidParams, 'URL parameter is required and must be a string');
                    }
                    const baseUrl = new URL(url);
                    const visited = new Set();
                    const sitemap = [];
                    const queue = [{ url, depth: 0 }];
                    while (queue.length > 0 && sitemap.length < maxPages) {
                        const { url: currentUrl, depth } = queue.shift();
                        if (visited.has(currentUrl) || depth > maxDepth) {
                            continue;
                        }
                        visited.add(currentUrl);
                        try {
                            const fetchResult = await fetchUrl(currentUrl, {
                                forceRefresh: !useCache,
                            });
                            const $ = cheerio.load(fetchResult.content);
                            const pageInfo = {
                                url: currentUrl,
                                depth,
                                title: $('title').text().trim(),
                                description: $('meta[name="description"]').attr('content') || '',
                                lastModified: new Date().toISOString(),
                                status: 'accessible',
                            };
                            sitemap.push(pageInfo);
                            // Extract links for next level
                            if (depth < maxDepth) {
                                $('a[href]').each((_, element) => {
                                    const href = $(element).attr('href');
                                    if (href) {
                                        try {
                                            const linkUrl = new URL(href, currentUrl).toString();
                                            const linkHost = new URL(linkUrl).hostname;
                                            // Only include same-domain links unless external is allowed
                                            if (includeExternal || linkHost === baseUrl.hostname) {
                                                if (!visited.has(linkUrl)) {
                                                    queue.push({ url: linkUrl, depth: depth + 1 });
                                                }
                                            }
                                        }
                                        catch {
                                            // Skip invalid URLs
                                        }
                                    }
                                });
                            }
                        }
                        catch (error) {
                            sitemap.push({
                                url: currentUrl,
                                depth,
                                status: 'error',
                                error: error instanceof Error ? error.message : 'Unknown error',
                            });
                        }
                    }
                    const result = {
                        baseUrl: url,
                        generatedAt: new Date().toISOString(),
                        maxDepth,
                        maxPages,
                        pagesFound: sitemap.length,
                        sitemap,
                        summary: {
                            accessible: sitemap.filter(p => p.status === 'accessible').length,
                            errors: sitemap.filter(p => p.status === 'error').length,
                            depthDistribution: Array.from({ length: maxDepth + 1 }, (_, i) => ({
                                depth: i,
                                count: sitemap.filter(p => p.depth === i).length,
                            })),
                        },
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
                case 'validate_html': {
                    const { url, checks = ['all'], useCache = true, } = args;
                    if (!url || typeof url !== 'string') {
                        throw new McpError(ErrorCode.InvalidParams, 'URL parameter is required and must be a string');
                    }
                    const fetchResult = await fetchUrl(url, {
                        forceRefresh: !useCache,
                    });
                    const $ = cheerio.load(fetchResult.content);
                    const shouldCheck = (check) => checks.includes('all') || checks.includes(check);
                    const validation = {
                        url: fetchResult.url,
                        timestamp: new Date().toISOString(),
                        issues: [],
                        warnings: [],
                        summary: {},
                    };
                    if (shouldCheck('structure')) {
                        // Check basic HTML structure
                        if (!$('html').length)
                            validation.issues.push('Missing <html> tag');
                        if (!$('head').length)
                            validation.issues.push('Missing <head> tag');
                        if (!$('body').length)
                            validation.issues.push('Missing <body> tag');
                        if (!$('title').length)
                            validation.issues.push('Missing <title> tag');
                        if ($('title').length > 1)
                            validation.issues.push('Multiple <title> tags found');
                        // Check for duplicate IDs
                        const ids = [];
                        $('[id]').each((_, element) => {
                            const id = $(element).attr('id');
                            if (id) {
                                if (ids.includes(id)) {
                                    validation.issues.push(`Duplicate ID found: ${id}`);
                                }
                                else {
                                    ids.push(id);
                                }
                            }
                        });
                    }
                    if (shouldCheck('accessibility')) {
                        // Check accessibility issues
                        $('img:not([alt])').each((_, element) => {
                            validation.issues.push(`Image missing alt attribute: ${$(element).attr('src') || 'unknown'}`);
                        });
                        $('input:not([aria-label]):not([aria-labelledby])').each((_, element) => {
                            const id = $(element).attr('id');
                            if (!id || !$(`label[for="${id}"]`).length) {
                                validation.issues.push(`Input missing label: ${$(element).attr('name') || 'unknown'}`);
                            }
                        });
                        if ($('h1').length === 0)
                            validation.warnings.push('No H1 heading found');
                        if ($('h1').length > 1)
                            validation.warnings.push('Multiple H1 headings found');
                    }
                    if (shouldCheck('seo')) {
                        // Check SEO issues
                        const title = $('title').text().trim();
                        if (title.length === 0)
                            validation.issues.push('Empty title tag');
                        if (title.length > 60)
                            validation.warnings.push('Title tag too long (>60 characters)');
                        if (title.length < 30)
                            validation.warnings.push('Title tag too short (<30 characters)');
                        const description = $('meta[name="description"]').attr('content') || '';
                        if (description.length === 0)
                            validation.warnings.push('Missing meta description');
                        if (description.length > 160)
                            validation.warnings.push('Meta description too long (>160 characters)');
                        if (description.length < 120)
                            validation.warnings.push('Meta description too short (<120 characters)');
                    }
                    if (shouldCheck('performance')) {
                        // Check performance issues
                        const imageCount = $('img').length;
                        if (imageCount > 20)
                            validation.warnings.push(`High number of images: ${imageCount}`);
                        const scriptCount = $('script').length;
                        if (scriptCount > 10)
                            validation.warnings.push(`High number of scripts: ${scriptCount}`);
                        $('img:not([width]):not([height])').each((_, element) => {
                            validation.warnings.push(`Image without dimensions: ${$(element).attr('src') || 'unknown'}`);
                        });
                    }
                    validation.summary = {
                        totalIssues: validation.issues.length,
                        totalWarnings: validation.warnings.length,
                        checksPerformed: checks,
                        overallScore: Math.max(0, 100 - (validation.issues.length * 10) - (validation.warnings.length * 2)),
                    };
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(validation, null, 2),
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