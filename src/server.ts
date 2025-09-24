/**
 * MCP Web Scrape Server
 * Implements the Model Context Protocol for web content extraction
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { fetchUrl } from './fetch.js';
import { extractContent, summarizeContent } from './extract.js';
import { cache } from './cache.js';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';

/**
 * Calculate text similarity using a simple algorithm
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  if (text1 === text2) return 1.0;
  if (text1.length === 0 || text2.length === 0) return 0.0;

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
export function createServer(): Server {
  const server = new Server(
    {
      name: 'mcp-web-scrape',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

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
        // Content Transformation Tools
        {
          name: 'convert_to_pdf',
          description: 'Convert web page content to PDF format',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to convert to PDF',
              },
              format: {
                type: 'string',
                enum: ['A4', 'Letter', 'Legal'],
                description: 'PDF page format (default: A4)',
                default: 'A4',
              },
              includeImages: {
                type: 'boolean',
                description: 'Whether to include images in PDF (default: true)',
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
          name: 'extract_text_only',
          description: 'Extract plain text content without any formatting or HTML',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to extract text from',
              },
              removeWhitespace: {
                type: 'boolean',
                description: 'Whether to remove extra whitespace (default: true)',
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
          name: 'generate_word_cloud',
          description: 'Generate word frequency analysis and word cloud data from web content',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to analyze for word frequency',
              },
              maxWords: {
                type: 'number',
                description: 'Maximum number of words to include (default: 100)',
                default: 100,
              },
              minLength: {
                type: 'number',
                description: 'Minimum word length to include (default: 3)',
                default: 3,
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
          name: 'translate_content',
          description: 'Translate web page content to different languages',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to translate',
              },
              targetLanguage: {
                type: 'string',
                description: 'Target language code (e.g., es, fr, de, zh)',
              },
              sourceLanguage: {
                type: 'string',
                description: 'Source language code (auto-detect if not provided)',
              },
              useCache: {
                type: 'boolean',
                description: 'Whether to use cached content if available (default: true)',
                default: true,
              },
            },
            required: ['url', 'targetLanguage'],
          },
        },
        {
          name: 'extract_keywords',
          description: 'Extract important keywords and phrases from web content',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to extract keywords from',
              },
              maxKeywords: {
                type: 'number',
                description: 'Maximum number of keywords to extract (default: 20)',
                default: 20,
              },
              includePhrases: {
                type: 'boolean',
                description: 'Whether to include multi-word phrases (default: true)',
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
        // Advanced Analysis Tools
        {
          name: 'analyze_readability',
          description: 'Analyze text readability using various metrics',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to analyze readability for',
              },
              metrics: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['flesch', 'gunning-fog', 'coleman-liau', 'ari', 'all'],
                },
                description: 'Readability metrics to calculate (default: all)',
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
          name: 'detect_language',
          description: 'Detect the primary language of web page content',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to detect language for',
              },
              confidence: {
                type: 'boolean',
                description: 'Whether to include confidence scores (default: true)',
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
          name: 'extract_entities',
          description: 'Extract named entities (people, places, organizations) from web content',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to extract entities from',
              },
              entityTypes: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['person', 'organization', 'location', 'date', 'money', 'all'],
                },
                description: 'Types of entities to extract (default: all)',
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
          name: 'sentiment_analysis',
          description: 'Analyze sentiment and emotional tone of web content',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to analyze sentiment for',
              },
              granularity: {
                type: 'string',
                enum: ['document', 'paragraph', 'sentence'],
                description: 'Level of sentiment analysis (default: document)',
                default: 'document',
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
          name: 'classify_content',
          description: 'Classify web content into categories and topics',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to classify content for',
              },
              categories: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['news', 'blog', 'ecommerce', 'education', 'entertainment', 'technology', 'business', 'health', 'sports', 'all'],
                },
                description: 'Content categories to classify into (default: all)',
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
        // SEO & Marketing Tools
        {
          name: 'analyze_competitors',
          description: 'Analyze competitor websites for SEO and content insights',
          inputSchema: {
            type: 'object',
            properties: {
              urls: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Array of competitor URLs to analyze',
              },
              metrics: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['keywords', 'meta-tags', 'headings', 'links', 'performance', 'all'],
                },
                description: 'Metrics to compare (default: all)',
                default: ['all'],
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
          name: 'extract_schema_markup',
          description: 'Extract and validate schema.org structured data markup',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to extract schema markup from',
              },
              schemaTypes: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['Article', 'Product', 'Organization', 'Person', 'Event', 'Recipe', 'all'],
                },
                description: 'Schema types to extract (default: all)',
                default: ['all'],
              },
              validate: {
                type: 'boolean',
                description: 'Whether to validate schema markup (default: true)',
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
          name: 'check_broken_links',
          description: 'Check for broken links and redirects on web pages',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to check for broken links',
              },
              checkExternal: {
                type: 'boolean',
                description: 'Whether to check external links (default: true)',
                default: true,
              },
              timeout: {
                type: 'number',
                description: 'Timeout for link checks in seconds (default: 10)',
                default: 10,
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
          name: 'analyze_page_speed',
          description: 'Analyze page loading speed and performance metrics',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to analyze page speed for',
              },
              device: {
                type: 'string',
                enum: ['desktop', 'mobile', 'both'],
                description: 'Device type for analysis (default: both)',
                default: 'both',
              },
              metrics: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['fcp', 'lcp', 'cls', 'fid', 'ttfb', 'all'],
                },
                description: 'Performance metrics to analyze (default: all)',
                default: ['all'],
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'generate_meta_tags',
          description: 'Generate optimized meta tags for SEO based on content analysis',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to generate meta tags for',
              },
              targetKeywords: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Target keywords for optimization',
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
        // Security & Privacy Tools
        {
          name: 'scan_vulnerabilities',
          description: 'Scan web pages for common security vulnerabilities',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to scan for vulnerabilities',
              },
              scanTypes: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['xss', 'csrf', 'headers', 'forms', 'cookies', 'all'],
                },
                description: 'Types of vulnerability scans to perform (default: all)',
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
          name: 'check_ssl_certificate',
          description: 'Check SSL certificate validity and security details',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to check SSL certificate for',
              },
              includeChain: {
                type: 'boolean',
                description: 'Whether to include certificate chain details (default: false)',
                default: false,
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'analyze_cookies',
          description: 'Analyze cookies set by web pages for privacy and security',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to analyze cookies for',
              },
              includeThirdParty: {
                type: 'boolean',
                description: 'Whether to include third-party cookies (default: true)',
                default: true,
              },
              checkSecurity: {
                type: 'boolean',
                description: 'Whether to check cookie security flags (default: true)',
                default: true,
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'detect_tracking',
          description: 'Detect tracking scripts and privacy-related elements',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to detect tracking on',
              },
              trackerTypes: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['analytics', 'advertising', 'social', 'fingerprinting', 'all'],
                },
                description: 'Types of trackers to detect (default: all)',
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
          name: 'check_privacy_policy',
          description: 'Analyze privacy policy content and compliance',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to check privacy policy for',
              },
              regulations: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['gdpr', 'ccpa', 'coppa', 'pipeda', 'all'],
                },
                description: 'Privacy regulations to check compliance for (default: all)',
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
        // Advanced Monitoring Tools
        {
          name: 'monitor_uptime',
          description: 'Monitor website uptime and availability',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to monitor uptime for',
              },
              interval: {
                type: 'number',
                description: 'Check interval in seconds (default: 300)',
                default: 300,
              },
              timeout: {
                type: 'number',
                description: 'Request timeout in seconds (default: 30)',
                default: 30,
              },
              expectedStatus: {
                type: 'number',
                description: 'Expected HTTP status code (default: 200)',
                default: 200,
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'track_changes_detailed',
          description: 'Track detailed changes in web page content with diff analysis',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to track changes for',
              },
              sections: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['title', 'headings', 'content', 'links', 'images', 'all'],
                },
                description: 'Page sections to track changes for (default: all)',
                default: ['all'],
              },
              sensitivity: {
                type: 'string',
                enum: ['low', 'medium', 'high'],
                description: 'Change detection sensitivity (default: medium)',
                default: 'medium',
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
          name: 'analyze_traffic_patterns',
          description: 'Analyze traffic patterns and user behavior indicators',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to analyze traffic patterns for',
              },
              timeframe: {
                type: 'string',
                enum: ['1h', '24h', '7d', '30d'],
                description: 'Analysis timeframe (default: 24h)',
                default: '24h',
              },
              metrics: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['pageviews', 'bounce-rate', 'session-duration', 'referrers', 'all'],
                },
                description: 'Traffic metrics to analyze (default: all)',
                default: ['all'],
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'benchmark_performance',
          description: 'Benchmark website performance against competitors and industry standards',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to benchmark performance for',
              },
              competitors: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Competitor URLs for comparison',
              },
              metrics: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['speed', 'seo', 'accessibility', 'security', 'all'],
                },
                description: 'Performance metrics to benchmark (default: all)',
                default: ['all'],
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'generate_reports',
          description: 'Generate comprehensive reports combining multiple analysis tools',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to generate report for',
              },
              reportType: {
                type: 'string',
                enum: ['seo', 'performance', 'security', 'accessibility', 'comprehensive'],
                description: 'Type of report to generate (default: comprehensive)',
                default: 'comprehensive',
              },
              format: {
                type: 'string',
                enum: ['json', 'html', 'markdown'],
                description: 'Report output format (default: json)',
                default: 'json',
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
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Unsupported URI scheme: ${uri}`
      );
    }

    const url = decodeURIComponent(uri.replace('cache://', ''));
    const entry = cache.get(url);

    if (!entry) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `No cached content found for URL: ${url}`
      );
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
          const {
            url,
            format = 'markdown',
            includeImages = true,
            includeLinks = true,
            bypassRobots = false,
            useCache = true,
          } = args as {
            url: string;
            format?: 'markdown' | 'text' | 'json';
            includeImages?: boolean;
            includeLinks?: boolean;
            bypassRobots?: boolean;
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
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
          const {
            content,
            maxLength = 500,
            format = 'paragraph',
          } = args as {
            content: string;
            maxLength?: number;
            format?: 'paragraph' | 'bullets';
          };

          if (!content || typeof content !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'Content parameter is required and must be a string'
            );
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
          const { url } = args as { url?: string };

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
          } else {
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
          const { url, useCache = true } = args as {
            url: string;
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: false,
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
          const { url, followRedirects = true } = args as {
            url: string;
            followRedirects?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
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
          } catch (error) {
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
          const {
            url,
            linkType = 'all',
            includeAnchorText = true,
            useCache = true,
          } = args as {
            url: string;
            linkType?: 'all' | 'internal' | 'external';
            includeAnchorText?: boolean;
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: false,
          });

          const $ = cheerio.load(fetchResult.content);
          const baseUrl = new URL(fetchResult.url);
          
          const links: Array<{
            href: string;
            text?: string;
            title?: string;
            type: 'internal' | 'external';
          }> = [];

          $('a[href]').each((_, element) => {
            const href = $(element).attr('href');
            if (!href) return;

            try {
              const absoluteUrl = new URL(href, baseUrl.origin).href;
              const isInternal = new URL(absoluteUrl).hostname === baseUrl.hostname;
              const type = isInternal ? 'internal' : 'external';

              if (linkType === 'all' || linkType === type) {
                const link: any = {
                  href: absoluteUrl,
                  type,
                };

                if (includeAnchorText) {
                  link.text = $(element).text().trim();
                  link.title = $(element).attr('title') || '';
                }

                links.push(link);
              }
            } catch {
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
          const {
            url,
            includeAltText = true,
            includeDimensions = false,
            useCache = true,
          } = args as {
            url: string;
            includeAltText?: boolean;
            includeDimensions?: boolean;
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const $ = cheerio.load(fetchResult.content);
          const baseUrl = new URL(fetchResult.url);
          
          const images: Array<{
            src: string;
            alt?: string;
            title?: string;
            width?: string;
            height?: string;
          }> = [];

          $('img[src]').each((_, element) => {
            const src = $(element).attr('src');
            if (!src) return;

            try {
              const absoluteUrl = new URL(src, baseUrl.origin).href;
              const image: any = {
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
            } catch {
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
          const {
            content,
            query,
            caseSensitive = false,
            useRegex = false,
            maxResults = 10,
          } = args as {
            content: string;
            query: string;
            caseSensitive?: boolean;
            useRegex?: boolean;
            maxResults?: number;
          };

          if (!content || typeof content !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'Content parameter is required and must be a string'
            );
          }

          if (!query || typeof query !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'Query parameter is required and must be a string'
            );
          }

          const results: Array<{
            match: string;
            context: string;
            position: number;
            line: number;
          }> = [];

          try {
            const lines = content.split('\n');
            const searchPattern = useRegex 
              ? new RegExp(query, caseSensitive ? 'g' : 'gi')
              : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi');

            lines.forEach((line, lineIndex) => {
              if (results.length >= maxResults) return;

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

                if (!useRegex) break; // For non-regex, only find first match per line
              }
            });
          } catch (error) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `Invalid search pattern: ${error instanceof Error ? error.message : String(error)}`
            );
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
          const { includeEntries = false } = args as {
            includeEntries?: boolean;
          };

          const stats = cache.getStats();
          const result: any = {
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
          const { url, userAgent = '*' } = args as {
            url: string;
            userAgent?: string;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
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
          } catch (error) {
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
          const {
            url,
            dataTypes = ['json-ld', 'microdata', 'rdfa', 'opengraph'],
            useCache = true,
          } = args as {
            url: string;
            dataTypes?: string[];
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const $ = cheerio.load(fetchResult.content);
          
          const structuredData: any = {
            url: fetchResult.url,
            extractedTypes: [],
          };

          // Extract JSON-LD
          if (dataTypes.includes('json-ld')) {
            const jsonLdScripts: any[] = [];
            $('script[type="application/ld+json"]').each((_, element) => {
              try {
                const jsonData = JSON.parse($(element).html() || '');
                jsonLdScripts.push(jsonData);
              } catch {
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
            const ogData: any = {};
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
            const microdataItems: any[] = [];
            $('[itemscope]').each((_, element) => {
              const item: any = {};
              const itemType = $(element).attr('itemtype');
              if (itemType) item.type = itemType;
              
              const properties: any = {};
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
          const {
            url1,
            url2,
            compareType = 'text',
            useCache = true,
          } = args as {
            url1: string;
            url2: string;
            compareType?: 'text' | 'structure' | 'metadata';
            useCache?: boolean;
          };

          if (!url1 || typeof url1 !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'url1 parameter is required and must be a string'
            );
          }

          if (!url2 || typeof url2 !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'url2 parameter is required and must be a string'
            );
          }

          const [fetchResult1, fetchResult2] = await Promise.all([
            fetchUrl(url1, { forceRefresh: !useCache }),
            fetchUrl(url2, { forceRefresh: !useCache }),
          ]);

          const extracted1 = extractContent(fetchResult1.content, fetchResult1.url);
          const extracted2 = extractContent(fetchResult2.content, fetchResult2.url);

          let comparison: any = {
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
          } else if (compareType === 'metadata') {
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
          } else if (compareType === 'structure') {
            const $1 = cheerio.load(fetchResult1.content);
            const $2 = cheerio.load(fetchResult2.content);
            
            const getStructure = ($: any) => {
              const structure: any = {};
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
          const {
            urls,
            format = 'markdown',
            maxConcurrent = 3,
            useCache = true,
          } = args as {
            urls: string[];
            format?: 'markdown' | 'text' | 'json';
            maxConcurrent?: number;
            useCache?: boolean;
          };

          if (!Array.isArray(urls) || urls.length === 0) {
            throw new McpError(
              ErrorCode.InvalidParams,
              'urls parameter is required and must be a non-empty array'
            );
          }

          if (urls.some(url => typeof url !== 'string')) {
            throw new McpError(
              ErrorCode.InvalidParams,
              'All URLs must be strings'
            );
          }

          if (urls.length > 20) {
            throw new McpError(
              ErrorCode.InvalidParams,
              'Maximum 20 URLs allowed per batch'
            );
          }

          const results: any[] = [];
          const errors: any[] = [];

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
              } catch (error) {
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
              } else {
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
          const {
            url,
            includeHidden = false,
            includeDisabled = false,
            useCache = true,
          } = args as {
            url: string;
            includeHidden?: boolean;
            includeDisabled?: boolean;
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const $ = cheerio.load(fetchResult.content);
          const forms: any[] = [];

          $('form').each((_, formElement) => {
            const form: any = {
              action: $(formElement).attr('action') || '',
              method: $(formElement).attr('method') || 'GET',
              enctype: $(formElement).attr('enctype') || 'application/x-www-form-urlencoded',
              name: $(formElement).attr('name') || '',
              id: $(formElement).attr('id') || '',
              fields: [],
            };

            // Extract form fields
            $(formElement).find('input, textarea, select').each((_, fieldElement) => {
              const tagName = $(fieldElement).prop('tagName')?.toLowerCase();
              const field: any = {
                type: $(fieldElement).attr('type') || tagName,
                name: $(fieldElement).attr('name') || '',
                id: $(fieldElement).attr('id') || '',
                value: String($(fieldElement).val() ?? ''),
                placeholder: $(fieldElement).attr('placeholder') || '',
                required: $(fieldElement).attr('required') !== undefined,
                disabled: $(fieldElement).attr('disabled') !== undefined,
                hidden: $(fieldElement).attr('type') === 'hidden',
              };

              // Add label if available
              if (field.id) {
                const label = $(formElement).find(`label[for="${field.id}"]`).text().trim();
                if (label) field.label = label;
              }

              // Filter based on options
              if (!includeHidden && field.hidden) return;
              if (!includeDisabled && field.disabled) return;

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
          const {
            url,
            format = 'json',
            includeHeaders = true,
            minRows = 1,
            useCache = true,
          } = args as {
            url: string;
            format?: 'json' | 'csv' | 'markdown';
            includeHeaders?: boolean;
            minRows?: number;
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const $ = cheerio.load(fetchResult.content);
          const tables: any[] = [];

          $('table').each((tableIndex, tableElement) => {
            const rows: string[][] = [];
            let headers: string[] = [];

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
              const row: string[] = [];
              $(rowElement).find('td, th').each((_, cellElement) => {
                row.push($(cellElement).text().trim());
              });
              if (row.length > 0) rows.push(row);
            });

            // Filter by minimum rows
            if (rows.length >= minRows) {
              const table: any = {
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
                csvContent += rows.map(row => 
                  row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
                ).join('\n');
                table.csv = csvContent;
              } else if (format === 'markdown') {
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
          const {
            url,
            platforms = ['all'],
            useCache = true,
          } = args as {
            url: string;
            platforms?: string[];
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const $ = cheerio.load(fetchResult.content);
          const socialLinks: any = {};

          const platformPatterns = {
            twitter: /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/,
            facebook: /facebook\.com\/([a-zA-Z0-9._]+)/,
            instagram: /instagram\.com\/([a-zA-Z0-9._]+)/,
            linkedin: /linkedin\.com\/(?:in|company)\/([a-zA-Z0-9-]+)/,
            youtube: /youtube\.com\/(?:channel\/|user\/|c\/)?([a-zA-Z0-9_-]+)/,
            tiktok: /tiktok\.com\/@([a-zA-Z0-9._]+)/,
          };

          const shouldExtract = (platform: string) => 
            platforms.includes('all') || platforms.includes(platform);

          // Extract from links
          $('a[href]').each((_, linkElement) => {
            const href = $(linkElement).attr('href') || '';
            const text = $(linkElement).text().trim();

            Object.entries(platformPatterns).forEach(([platform, pattern]) => {
              if (shouldExtract(platform) && pattern.test(href)) {
                if (!socialLinks[platform]) socialLinks[platform] = [];
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
          const metaSocial: any = {};
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
          const {
            url,
            types = ['all'],
            useCache = true,
          } = args as {
            url: string;
            types?: string[];
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const $ = cheerio.load(fetchResult.content);
          const contactInfo: any = {};

          const shouldExtract = (type: string) => 
            types.includes('all') || types.includes(type);

          // Extract emails
          if (shouldExtract('email')) {
            const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
            const pageText = $.text();
            const emails = [...new Set(pageText.match(emailPattern) || [])];
            
            // Also check mailto links
            const mailtoEmails: string[] = [];
            $('a[href^="mailto:"]').each((_, linkElement) => {
              const href = $(linkElement).attr('href') || '';
              const email = href.replace('mailto:', '').split('?')[0];
              if (email) mailtoEmails.push(email);
            });
            
            contactInfo.emails = [...new Set([...emails, ...mailtoEmails])];
          }

          // Extract phone numbers (international format support)
          if (shouldExtract('phone')) {
            // More comprehensive regex for international phone numbers
            // Supports E.164 format and common international patterns
            const phonePattern = /(?:\+?[1-9]\d{0,3}[-\s]?)?(?:\(?\d{1,4}\)?[-\s]?)?\d{1,4}[-\s]?\d{1,4}[-\s]?\d{1,9}/g;
            const pageText = $.text();
            const phones = [...new Set(pageText.match(phonePattern) || [])];
            
            // Also check tel links
            const telPhones: string[] = [];
            $('a[href^="tel:"]').each((_, linkElement) => {
              const href = $(linkElement).attr('href') || '';
              const phone = href.replace('tel:', '');
              if (phone) telPhones.push(phone);
            });
            
            contactInfo.phones = [...new Set([...phones, ...telPhones])];
          }

          // Extract addresses (basic implementation)
          if (shouldExtract('address')) {
            const addresses: string[] = [];
            
            // Look for address-like patterns
            $('[class*="address"], [id*="address"], address').each((_, element) => {
              const text = $(element).text().trim();
              if (text.length > 10) addresses.push(text);
            });
            
            // Look for structured data addresses
            $('[itemtype*="PostalAddress"], [typeof*="PostalAddress"]').each((_, element) => {
              const text = $(element).text().trim();
              if (text.length > 10) addresses.push(text);
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
          const {
            url,
            levels = [1, 2, 3, 4, 5, 6],
            includeText = true,
            useCache = true,
          } = args as {
            url: string;
            levels?: number[];
            includeText?: boolean;
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const $ = cheerio.load(fetchResult.content);
          const headings: any[] = [];

          levels.forEach(level => {
            $(`h${level}`).each((index, element) => {
              const heading: any = {
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
            if (a.level !== b.level) return a.level - b.level;
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
          const {
            url,
            maxItems = 10,
            includeContent = false,
            useCache = true,
          } = args as {
            url: string;
            maxItems?: number;
            includeContent?: boolean;
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const $ = cheerio.load(fetchResult.content);
          const feeds: any[] = [];

          // Discover feed links
          const feedLinks: string[] = [];
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
            } catch {
              // Skip invalid URLs
            }
          }

          // Fetch and parse feeds
          for (const feedUrl of [...new Set(feedLinks)]) {
            try {
              const feedResult = await fetchUrl(feedUrl, { forceRefresh: !useCache });
              const feed$ = cheerio.load(feedResult.content, { xmlMode: true });
              
              const feedData: any = {
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
                const item: any = {
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
            } catch {
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
          const {
            url,
            interval = 3600,
            threshold = 0.1,
            useCache = true,
          } = args as {
            url: string;
            interval?: number;
            threshold?: number;
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const $ = cheerio.load(fetchResult.content);
          const currentContent = $.text().trim();
          const currentHash = createHash('md5').update(currentContent).digest('hex');
          
          // Store monitoring data (in a real implementation, this would be persisted)
          const monitoringKey = `monitor_${Buffer.from(url).toString('base64')}`;
          const previousData = cache.get(monitoringKey) as any;
          
          const result: any = {
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
          } else {
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
          const {
            url,
            metrics = ['all'],
            useCache = true,
          } = args as {
            url: string;
            metrics?: string[];
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const startTime = Date.now();
          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });
          const endTime = Date.now();

          const $ = cheerio.load(fetchResult.content);
          const shouldAnalyze = (metric: string) => 
            metrics.includes('all') || metrics.includes(metric);

          const performance: any = {
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
            performance.totalResources = Object.values(resources).reduce((a: number, b: number) => a + b, 0);
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
          const {
            url,
            maxDepth = 2,
            maxPages = 50,
            includeExternal = false,
            useCache = true,
          } = args as {
            url: string;
            maxDepth?: number;
            maxPages?: number;
            includeExternal?: boolean;
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const baseUrl = new URL(url);
          const visited = new Set<string>();
          const sitemap: any[] = [];
          const queue: Array<{ url: string; depth: number }> = [{ url, depth: 0 }];

          while (queue.length > 0 && sitemap.length < maxPages) {
            const { url: currentUrl, depth } = queue.shift()!;
            
            if (visited.has(currentUrl) || depth > maxDepth) {
              continue;
            }

            // Add delay between requests to avoid overwhelming the server
            if (visited.size > 0) {
              await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
            }

            visited.add(currentUrl);

            try {
              const fetchResult = await fetchUrl(currentUrl, {
                forceRefresh: !useCache,
              });

              const $ = cheerio.load(fetchResult.content);
              const pageInfo: any = {
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
                    } catch {
                      // Skip invalid URLs
                    }
                  }
                });
              }
            } catch (error) {
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
          const {
            url,
            checks = ['all'],
            useCache = true,
          } = args as {
            url: string;
            checks?: string[];
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const $ = cheerio.load(fetchResult.content);
          const shouldCheck = (check: string) => 
            checks.includes('all') || checks.includes(check);

          const validation: any = {
            url: fetchResult.url,
            timestamp: new Date().toISOString(),
            issues: [],
            warnings: [],
            summary: {},
          };

          if (shouldCheck('structure')) {
            // Check basic HTML structure
            if (!$('html').length) validation.issues.push('Missing <html> tag');
            if (!$('head').length) validation.issues.push('Missing <head> tag');
            if (!$('body').length) validation.issues.push('Missing <body> tag');
            if (!$('title').length) validation.issues.push('Missing <title> tag');
            if ($('title').length > 1) validation.issues.push('Multiple <title> tags found');
            
            // Check for duplicate IDs
            const ids: string[] = [];
            $('[id]').each((_, element) => {
              const id = $(element).attr('id');
              if (id) {
                if (ids.includes(id)) {
                  validation.issues.push(`Duplicate ID found: ${id}`);
                } else {
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
            
            if ($('h1').length === 0) validation.warnings.push('No H1 heading found');
            if ($('h1').length > 1) validation.warnings.push('Multiple H1 headings found');
          }

          if (shouldCheck('seo')) {
            // Check SEO issues
            const title = $('title').text().trim();
            if (title.length === 0) validation.issues.push('Empty title tag');
            if (title.length > 60) validation.warnings.push('Title tag too long (>60 characters)');
            if (title.length < 30) validation.warnings.push('Title tag too short (<30 characters)');
            
            const description = $('meta[name="description"]').attr('content') || '';
            if (description.length === 0) validation.warnings.push('Missing meta description');
            if (description.length > 160) validation.warnings.push('Meta description too long (>160 characters)');
            if (description.length < 120) validation.warnings.push('Meta description too short (<120 characters)');
          }

          if (shouldCheck('performance')) {
            // Check performance issues
            const imageCount = $('img').length;
            if (imageCount > 20) validation.warnings.push(`High number of images: ${imageCount}`);
            
            const scriptCount = $('script').length;
            if (scriptCount > 10) validation.warnings.push(`High number of scripts: ${scriptCount}`);
            
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

        // Content Transformation Tools
        case 'convert_to_pdf': {
          const {
            url,
            format = 'A4',
            includeImages = true,
            useCache = true,
          } = args as {
            url: string;
            format?: 'A4' | 'Letter' | 'Legal';
            includeImages?: boolean;
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const extracted = extractContent(fetchResult.content, fetchResult.url);
          
          // Simulate PDF conversion (in a real implementation, you'd use a library like puppeteer)
          const pdfInfo = {
            url: fetchResult.url,
            title: extracted.title,
            format,
            includeImages,
            pageCount: Math.ceil(extracted.wordCount / 500), // Estimate pages
            size: `${Math.ceil(extracted.content.length / 1024)}KB`,
            generated: new Date().toISOString(),
            content: includeImages ? extracted.content : extracted.content.replace(/!\[.*?\]\(.*?\)/g, ''),
          };

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(pdfInfo, null, 2),
              },
            ],
          };
        }

        case 'extract_text_only': {
          const {
            url,
            removeWhitespace = true,
            useCache = true,
          } = args as {
            url: string;
            removeWhitespace?: boolean;
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const $ = cheerio.load(fetchResult.content);
          
          // Remove script and style elements
          $('script, style, nav, header, footer, aside').remove();
          
          // Extract plain text
          let text = $('body').text() || $.text();
          
          if (removeWhitespace) {
            text = text.replace(/\s+/g, ' ').trim();
          }

          const result = {
            url: fetchResult.url,
            textLength: text.length,
            wordCount: text.split(/\s+/).filter(word => word.length > 0).length,
            text,
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

        case 'generate_word_cloud': {
          const {
            url,
            maxWords = 100,
            minLength = 3,
            useCache = true,
          } = args as {
            url: string;
            maxWords?: number;
            minLength?: number;
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const extracted = extractContent(fetchResult.content, fetchResult.url);
          
          // Extract words and count frequency
          const words = extracted.content
            .toLowerCase()
            .replace(/[^a-z\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length >= minLength)
            .filter(word => !['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'a', 'an'].includes(word));

          const wordCount: Record<string, number> = {};
          words.forEach(word => {
            wordCount[word] = (wordCount[word] || 0) + 1;
          });

          const sortedWords = Object.entries(wordCount)
            .sort(([, a], [, b]) => b - a)
            .slice(0, maxWords)
            .map(([word, count]) => ({ word, count, frequency: count / words.length }));

          const result = {
            url: fetchResult.url,
            totalWords: words.length,
            uniqueWords: Object.keys(wordCount).length,
            maxWords,
            minLength,
            wordCloud: sortedWords,
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

        case 'translate_content': {
          const {
            url,
            targetLanguage,
            sourceLanguage,
            useCache = true,
          } = args as {
            url: string;
            targetLanguage: string;
            sourceLanguage?: string;
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          if (!targetLanguage || typeof targetLanguage !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'targetLanguage parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const extracted = extractContent(fetchResult.content, fetchResult.url);
          
          // Simulate translation (in a real implementation, you'd use a translation API)
          const result = {
            url: fetchResult.url,
            originalTitle: extracted.title,
            translatedTitle: `[${targetLanguage.toUpperCase()}] ${extracted.title}`,
            sourceLanguage: sourceLanguage || 'auto-detected',
            targetLanguage,
            originalWordCount: extracted.wordCount,
            translatedContent: `[TRANSLATED TO ${targetLanguage.toUpperCase()}]\n\n${extracted.content}`,
            translationNote: 'This is a simulated translation. In a real implementation, this would use a translation service like Google Translate API.',
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

        case 'extract_keywords': {
          const {
            url,
            maxKeywords = 20,
            includePhrases = true,
            useCache = true,
          } = args as {
            url: string;
            maxKeywords?: number;
            includePhrases?: boolean;
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const extracted = extractContent(fetchResult.content, fetchResult.url);
          const $ = cheerio.load(fetchResult.content);
          
          // Extract keywords from meta tags
          const metaKeywords = $('meta[name="keywords"]').attr('content') || '';
          
          // Extract single words
          const words = extracted.content
            .toLowerCase()
            .replace(/[^a-z\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length >= 3)
            .filter(word => !['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'a', 'an'].includes(word));

          const wordCount: Record<string, number> = {};
          words.forEach(word => {
            wordCount[word] = (wordCount[word] || 0) + 1;
          });

          const keywords = Object.entries(wordCount)
            .sort(([, a], [, b]) => b - a)
            .slice(0, maxKeywords)
            .map(([word, count]) => ({ keyword: word, frequency: count, type: 'single' }));

          // Extract phrases if requested
          const phrases: Array<{ keyword: string; frequency: number; type: string }> = [];
          if (includePhrases) {
            const sentences = extracted.content.split(/[.!?]+/);
            const phraseCount: Record<string, number> = {};
            
            sentences.forEach(sentence => {
              const sentenceWords = sentence.toLowerCase().match(/\b\w{3,}\b/g) || [];
              for (let i = 0; i < sentenceWords.length - 1; i++) {
                const phrase = `${sentenceWords[i]} ${sentenceWords[i + 1]}`;
                phraseCount[phrase] = (phraseCount[phrase] || 0) + 1;
              }
            });

            phrases.push(...Object.entries(phraseCount)
              .filter(([, count]) => count >= 2)
              .sort(([, a], [, b]) => b - a)
              .slice(0, Math.floor(maxKeywords / 2))
              .map(([phrase, count]) => ({ keyword: phrase, frequency: count, type: 'phrase' })));
          }

          const result = {
            url: fetchResult.url,
            metaKeywords: metaKeywords.split(',').map(k => k.trim()).filter(k => k),
            extractedKeywords: [...keywords, ...phrases].slice(0, maxKeywords),
            totalWords: words.length,
            maxKeywords,
            includePhrases,
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

        // Advanced Analysis Tools
        case 'analyze_readability': {
          const {
            url,
            metrics = ['all'],
            useCache = true,
          } = args as {
            url: string;
            metrics?: string[];
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const extracted = extractContent(fetchResult.content, fetchResult.url);
          const text = extracted.content.replace(/[\[\]\(\)\*_`#]/g, ' ');
          
          // Calculate readability metrics
          const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
          const words = text.split(/\s+/).filter(w => w.length > 0);
          const syllables = words.reduce((total, word) => {
            return total + Math.max(1, word.toLowerCase().match(/[aeiouy]+/g)?.length || 1);
          }, 0);
          
          const avgWordsPerSentence = words.length / sentences.length;
          const avgSyllablesPerWord = syllables / words.length;
          
          // Flesch Reading Ease Score
          const fleschScore = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
          
          // Flesch-Kincaid Grade Level
          const gradeLevel = (0.39 * avgWordsPerSentence) + (11.8 * avgSyllablesPerWord) - 15.59;
          
          // Automated Readability Index
          const characters = text.replace(/\s/g, '').length;
          const ariScore = (4.71 * (characters / words.length)) + (0.5 * avgWordsPerSentence) - 21.43;
          
          const readabilityLevel = fleschScore >= 90 ? 'Very Easy' :
                                 fleschScore >= 80 ? 'Easy' :
                                 fleschScore >= 70 ? 'Fairly Easy' :
                                 fleschScore >= 60 ? 'Standard' :
                                 fleschScore >= 50 ? 'Fairly Difficult' :
                                 fleschScore >= 30 ? 'Difficult' : 'Very Difficult';

          const result = {
            url: fetchResult.url,
            textStats: {
              sentences: sentences.length,
              words: words.length,
              characters,
              syllables,
              avgWordsPerSentence: Math.round(avgWordsPerSentence * 100) / 100,
              avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
            },
            readabilityScores: {
              fleschReadingEase: Math.round(fleschScore * 100) / 100,
              fleschKincaidGrade: Math.round(gradeLevel * 100) / 100,
              automatedReadabilityIndex: Math.round(ariScore * 100) / 100,
            },
            readabilityLevel,
            recommendations: fleschScore < 60 ? [
              'Consider using shorter sentences',
              'Use simpler words where possible',
              'Break up long paragraphs',
              'Add more white space and formatting'
            ] : ['Content readability is good'],
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

        case 'detect_language': {
          const {
            url,
            confidence = 0.8,
            useCache = true,
          } = args as {
            url: string;
            confidence?: number;
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const extracted = extractContent(fetchResult.content, fetchResult.url);
          const $ = cheerio.load(fetchResult.content);
          
          // Get language from HTML lang attribute
          const htmlLang = $('html').attr('lang') || $('html').attr('xml:lang');
          
          // Simple language detection based on character patterns
          const text = extracted.content.toLowerCase();
          const languagePatterns = {
            'en': /\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/g,
            'es': /\b(el|la|los|las|y|o|pero|en|con|de|por|para)\b/g,
            'fr': /\b(le|la|les|et|ou|mais|dans|sur|avec|de|par|pour)\b/g,
            'de': /\b(der|die|das|und|oder|aber|in|auf|mit|von|für)\b/g,
            'it': /\b(il|la|lo|gli|le|e|o|ma|in|su|con|di|per)\b/g,
            'pt': /\b(o|a|os|as|e|ou|mas|em|com|de|por|para)\b/g,
            'ru': /[а-я]/g,
            'zh': /[\u4e00-\u9fff]/g,
            'ja': /[ひらがなカタカナ]/g,
            'ar': /[\u0600-\u06ff]/g,
          };
          
          const detectedLanguages: Array<{ language: string; confidence: number; matches: number }> = [];
          
          Object.entries(languagePatterns).forEach(([lang, pattern]) => {
            const matches = text.match(pattern);
            const matchCount = matches ? matches.length : 0;
            const langConfidence = Math.min(1, matchCount / (text.split(/\s+/).length * 0.1));
            
            if (langConfidence > 0.1) {
              detectedLanguages.push({
                language: lang,
                confidence: Math.round(langConfidence * 100) / 100,
                matches: matchCount,
              });
            }
          });
          
          detectedLanguages.sort((a, b) => b.confidence - a.confidence);
          
          const primaryLanguage = detectedLanguages[0] || { language: 'unknown', confidence: 0, matches: 0 };

          const result = {
            url: fetchResult.url,
            htmlLang,
            detectedLanguages: detectedLanguages.slice(0, 5),
            primaryLanguage,
            isConfident: primaryLanguage.confidence >= confidence,
            textSample: extracted.content.substring(0, 200) + '...',
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

        case 'extract_entities': {
          const {
            url,
            entityTypes = ['all'],
            useCache = true,
          } = args as {
            url: string;
            entityTypes?: string[];
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const extracted = extractContent(fetchResult.content, fetchResult.url);
          
          // Simple entity extraction using regex patterns
          const entities = {
            emails: [...extracted.content.matchAll(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g)].map(m => m[0]),
            urls: [...extracted.content.matchAll(/https?:\/\/[^\s]+/g)].map(m => m[0]),
            phones: [...extracted.content.matchAll(/\b(?:\+?1[-.]?)?\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})\b/g)].map(m => m[0]),
            dates: [...extracted.content.matchAll(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/gi)].map(m => m[0]),
            times: [...extracted.content.matchAll(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\b/g)].map(m => m[0]),
            currencies: [...extracted.content.matchAll(/\$\d+(?:,\d{3})*(?:\.\d{2})?|\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|EUR|GBP|JPY)/g)].map(m => m[0]),
            percentages: [...extracted.content.matchAll(/\d+(?:\.\d+)?%/g)].map(m => m[0]),
            hashtags: [...extracted.content.matchAll(/#\w+/g)].map(m => m[0]),
            mentions: [...extracted.content.matchAll(/@\w+/g)].map(m => m[0]),
            coordinates: [...extracted.content.matchAll(/\b-?\d{1,3}\.\d+,\s*-?\d{1,3}\.\d+\b/g)].map(m => m[0]),
          };
          
          // Remove duplicates
          Object.keys(entities).forEach(key => {
            entities[key as keyof typeof entities] = [...new Set(entities[key as keyof typeof entities])];
          });
          
          const totalEntities = Object.values(entities).reduce((sum, arr) => sum + arr.length, 0);

          const result = {
            url: fetchResult.url,
            entityTypes: entityTypes.includes('all') ? Object.keys(entities) : entityTypes,
            entities,
            summary: {
              totalEntities,
              entitiesByType: Object.fromEntries(
                Object.entries(entities).map(([type, items]) => [type, items.length])
              ),
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

        case 'sentiment_analysis': {
          const {
            url,
            granularity = 'overall',
            useCache = true,
          } = args as {
            url: string;
            granularity?: 'overall' | 'paragraph' | 'sentence';
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const extracted = extractContent(fetchResult.content, fetchResult.url);
          
          // Simple sentiment analysis using word lists
          const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'awesome', 'love', 'like', 'happy', 'pleased', 'satisfied', 'perfect', 'best', 'brilliant', 'outstanding', 'superb', 'magnificent', 'marvelous', 'terrific'];
          const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'hate', 'dislike', 'angry', 'sad', 'disappointed', 'frustrated', 'worst', 'disgusting', 'annoying', 'boring', 'useless', 'pathetic', 'ridiculous', 'stupid', 'ugly', 'nasty'];
          
          const analyzeSentiment = (text: string) => {
            const words = text.toLowerCase().split(/\W+/);
            let positiveCount = 0;
            let negativeCount = 0;
            
            words.forEach(word => {
              if (positiveWords.includes(word)) positiveCount++;
              if (negativeWords.includes(word)) negativeCount++;
            });
            
            const totalSentimentWords = positiveCount + negativeCount;
            const score = totalSentimentWords === 0 ? 0 : (positiveCount - negativeCount) / totalSentimentWords;
            
            const sentiment = score > 0.1 ? 'positive' : score < -0.1 ? 'negative' : 'neutral';
            
            return {
              score: Math.round(score * 100) / 100,
              sentiment,
              positiveWords: positiveCount,
              negativeWords: negativeCount,
              confidence: Math.min(1, totalSentimentWords / (words.length * 0.1)),
            };
          };
          
          let analysis;
          
          if (granularity === 'overall') {
            analysis = {
              overall: analyzeSentiment(extracted.content),
            };
          } else if (granularity === 'paragraph') {
            const paragraphs = extracted.content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
            analysis = {
              overall: analyzeSentiment(extracted.content),
              paragraphs: paragraphs.map((paragraph, index) => ({
                index,
                text: paragraph.substring(0, 100) + '...',
                ...analyzeSentiment(paragraph),
              })),
            };
          } else {
            const sentences = extracted.content.split(/[.!?]+/).filter(s => s.trim().length > 0);
            analysis = {
              overall: analyzeSentiment(extracted.content),
              sentences: sentences.slice(0, 20).map((sentence, index) => ({
                index,
                text: sentence.trim().substring(0, 100) + '...',
                ...analyzeSentiment(sentence),
              })),
            };
          }

          const result = {
            url: fetchResult.url,
            granularity,
            analysis,
            wordCount: extracted.wordCount,
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

        case 'classify_content': {
          const {
            url,
            categories = ['general'],
            useCache = true,
          } = args as {
            url: string;
            categories?: string[];
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const extracted = extractContent(fetchResult.content, fetchResult.url);
          const $ = cheerio.load(fetchResult.content);
          
          // Content classification based on keywords and patterns
          const contentKeywords = extracted.content.toLowerCase();
          
          const categoryKeywords = {
            technology: ['software', 'programming', 'code', 'developer', 'tech', 'computer', 'digital', 'app', 'website', 'api', 'database', 'algorithm', 'javascript', 'python', 'react', 'node'],
            business: ['company', 'business', 'market', 'sales', 'revenue', 'profit', 'customer', 'service', 'product', 'strategy', 'management', 'finance', 'investment', 'startup', 'enterprise'],
            education: ['learn', 'education', 'school', 'university', 'course', 'student', 'teacher', 'study', 'knowledge', 'skill', 'training', 'academic', 'research', 'degree', 'certification'],
            health: ['health', 'medical', 'doctor', 'patient', 'treatment', 'medicine', 'hospital', 'care', 'wellness', 'fitness', 'nutrition', 'disease', 'therapy', 'clinic', 'pharmaceutical'],
            news: ['news', 'report', 'article', 'journalist', 'media', 'press', 'breaking', 'update', 'story', 'headline', 'coverage', 'interview', 'investigation', 'politics', 'government'],
            entertainment: ['movie', 'music', 'game', 'entertainment', 'celebrity', 'show', 'film', 'video', 'streaming', 'concert', 'album', 'artist', 'actor', 'director', 'review'],
            sports: ['sport', 'team', 'player', 'game', 'match', 'score', 'league', 'championship', 'tournament', 'football', 'basketball', 'soccer', 'baseball', 'tennis', 'golf'],
            travel: ['travel', 'trip', 'vacation', 'hotel', 'flight', 'destination', 'tourism', 'adventure', 'explore', 'journey', 'booking', 'resort', 'guide', 'attraction', 'culture'],
            food: ['food', 'recipe', 'cooking', 'restaurant', 'chef', 'cuisine', 'meal', 'ingredient', 'dish', 'kitchen', 'dining', 'taste', 'flavor', 'nutrition', 'diet'],
            fashion: ['fashion', 'style', 'clothing', 'brand', 'design', 'trend', 'outfit', 'wear', 'collection', 'designer', 'model', 'beauty', 'accessories', 'luxury', 'retail'],
          };
          
          const classifications: Array<{ category: string; confidence: number; matchedKeywords: string[] }> = [];
          
          Object.entries(categoryKeywords).forEach(([category, keywords]) => {
            const matchedKeywords: string[] = [];
            let totalMatches = 0;
            
            keywords.forEach(keyword => {
              const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
              const matches = contentKeywords.match(regex);
              if (matches) {
                matchedKeywords.push(keyword);
                totalMatches += matches.length;
              }
            });
            
            const confidence = Math.min(1, totalMatches / (extracted.wordCount * 0.01));
            
            if (confidence > 0.1) {
              classifications.push({
                category,
                confidence: Math.round(confidence * 100) / 100,
                matchedKeywords,
              });
            }
          });
          
          classifications.sort((a, b) => b.confidence - a.confidence);
          
          // Additional metadata-based classification
          const metaDescription = $('meta[name="description"]').attr('content') || '';
          const metaKeywords = $('meta[name="keywords"]').attr('content') || '';
          const title = extracted.title;
          
          const result = {
            url: fetchResult.url,
            title,
            metaDescription,
            metaKeywords,
            classifications: classifications.slice(0, 5),
            primaryCategory: classifications[0]?.category || 'general',
            contentType: {
              isArticle: /article|blog|post|story/.test(contentKeywords),
              isProduct: /product|buy|price|shop|store/.test(contentKeywords),
              isService: /service|contact|about|help|support/.test(contentKeywords),
              isHomepage: /home|welcome|about us|company/.test(contentKeywords),
            },
            wordCount: extracted.wordCount,
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

        // SEO & Marketing Tools
        case 'analyze_competitors': {
          const {
            url,
            competitors = [],
            metrics = ['all'],
            useCache = true,
          } = args as {
            url: string;
            competitors?: string[];
            metrics?: string[];
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const extracted = extractContent(fetchResult.content, fetchResult.url);
          const $ = cheerio.load(fetchResult.content);
          
          // Analyze main site
          const analyzeWebsite = async (siteUrl: string) => {
            try {
              const siteResult = await fetchUrl(siteUrl, { forceRefresh: !useCache });
              const siteExtracted = extractContent(siteResult.content, siteResult.url);
              const site$ = cheerio.load(siteResult.content);
              
              return {
                url: siteResult.url,
                title: siteExtracted.title,
                description: site$('meta[name="description"]').attr('content') || '',
                keywords: site$('meta[name="keywords"]').attr('content') || '',
                wordCount: siteExtracted.wordCount,
                headings: {
                  h1: site$('h1').length,
                  h2: site$('h2').length,
                  h3: site$('h3').length,
                },
                images: site$('img').length,
                links: {
                  internal: site$('a[href^="/"], a[href*="' + new URL(siteUrl).hostname + '"]').length,
                  external: site$('a[href^="http"]').length - site$('a[href*="' + new URL(siteUrl).hostname + '"]').length,
                },
                socialMedia: {
                  facebook: site$('a[href*="facebook.com"]').length > 0,
                  twitter: site$('a[href*="twitter.com"], a[href*="x.com"]').length > 0,
                  linkedin: site$('a[href*="linkedin.com"]').length > 0,
                  instagram: site$('a[href*="instagram.com"]').length > 0,
                },
                technologies: {
                  hasAnalytics: siteResult.content.includes('google-analytics') || siteResult.content.includes('gtag'),
                  hasSchema: site$('script[type="application/ld+json"]').length > 0,
                  hasOpenGraph: site$('meta[property^="og:"]').length > 0,
                  hasTwitterCard: site$('meta[name^="twitter:"]').length > 0,
                },
              };
            } catch (error) {
              return {
                url: siteUrl,
                error: 'Failed to analyze competitor site',
                details: error instanceof Error ? error.message : 'Unknown error',
              };
            }
          };
          
          const mainSiteAnalysis = await analyzeWebsite(url);
          
          const competitorAnalyses = await Promise.all(
            competitors.slice(0, 5).map(competitor => analyzeWebsite(competitor))
          );
          
          // Compare metrics
          const comparison = {
            wordCount: {
              main: mainSiteAnalysis.wordCount || 0,
              competitors: competitorAnalyses.map(c => ({ url: c.url, count: c.wordCount || 0 })),
              average: competitorAnalyses.reduce((sum, c) => sum + (c.wordCount || 0), 0) / competitorAnalyses.length,
            },
            headings: {
              main: mainSiteAnalysis.headings || { h1: 0, h2: 0, h3: 0 },
              competitors: competitorAnalyses.map(c => ({ url: c.url, headings: c.headings || { h1: 0, h2: 0, h3: 0 } })),
            },
            socialPresence: {
              main: Object.values(mainSiteAnalysis.socialMedia || {}).filter(Boolean).length,
              competitors: competitorAnalyses.map(c => ({
                url: c.url,
                count: Object.values(c.socialMedia || {}).filter(Boolean).length,
              })),
            },
          };

          const result = {
            mainSite: mainSiteAnalysis,
            competitors: competitorAnalyses,
            comparison,
            recommendations: [
              mainSiteAnalysis.wordCount && mainSiteAnalysis.wordCount < comparison.wordCount.average
                ? 'Consider adding more content to match competitor word counts'
                : null,
              !mainSiteAnalysis.technologies?.hasSchema
                ? 'Add structured data (Schema.org) to improve SEO'
                : null,
              !mainSiteAnalysis.technologies?.hasOpenGraph
                ? 'Add Open Graph meta tags for better social media sharing'
                : null,
              comparison.socialPresence.main < Math.max(...comparison.socialPresence.competitors.map(c => c.count))
                ? 'Improve social media presence and linking'
                : null,
            ].filter(Boolean),
            analyzedAt: new Date().toISOString(),
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

        case 'extract_schema_markup': {
          const {
            url,
            schemaTypes = ['all'],
            useCache = true,
          } = args as {
            url: string;
            schemaTypes?: string[];
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const $ = cheerio.load(fetchResult.content);
          
          // Extract JSON-LD structured data
          const jsonLdScripts = $('script[type="application/ld+json"]');
          const jsonLdData: any[] = [];
          
          jsonLdScripts.each((_, element) => {
            try {
              const content = $(element).html();
              if (content) {
                const parsed = JSON.parse(content);
                jsonLdData.push(parsed);
              }
            } catch (error) {
              // Ignore invalid JSON
            }
          });
          
          // Extract microdata
          const microdataItems: any[] = [];
          $('[itemscope]').each((_, element) => {
            const $item = $(element);
            const itemType = $item.attr('itemtype');
            const properties: Record<string, any> = {};
            
            $item.find('[itemprop]').each((_, propElement) => {
              const $prop = $(propElement);
              const propName = $prop.attr('itemprop');
              let propValue = $prop.attr('content') || $prop.text().trim();
              
              if ($prop.is('img')) {
                propValue = $prop.attr('src');
              } else if ($prop.is('a')) {
                propValue = $prop.attr('href');
              }
              
              if (propName && propValue) {
                properties[propName] = propValue;
              }
            });
            
            if (itemType) {
              microdataItems.push({
                type: itemType,
                properties,
              });
            }
          });
          
          // Extract Open Graph data
          const openGraph: Record<string, string> = {};
          $('meta[property^="og:"]').each((_, element) => {
            const $meta = $(element);
            const property = $meta.attr('property');
            const content = $meta.attr('content');
            if (property && content) {
              openGraph[property] = content;
            }
          });
          
          // Extract Twitter Card data
          const twitterCard: Record<string, string> = {};
          $('meta[name^="twitter:"]').each((_, element) => {
            const $meta = $(element);
            const name = $meta.attr('name');
            const content = $meta.attr('content');
            if (name && content) {
              twitterCard[name] = content;
            }
          });
          
          // Extract basic meta tags
          const basicMeta = {
            title: $('title').text() || '',
            description: $('meta[name="description"]').attr('content') || '',
            keywords: $('meta[name="keywords"]').attr('content') || '',
            author: $('meta[name="author"]').attr('content') || '',
            robots: $('meta[name="robots"]').attr('content') || '',
            canonical: $('link[rel="canonical"]').attr('href') || '',
          };
          
          // Analyze schema types
          const schemaTypes_found = new Set<string>();
          jsonLdData.forEach(item => {
            if (item['@type']) {
              schemaTypes_found.add(item['@type']);
            }
          });
          
          microdataItems.forEach(item => {
            if (item.type) {
              const typeName = item.type.split('/').pop();
              if (typeName) {
                schemaTypes_found.add(typeName);
              }
            }
          });

          const result = {
            url: fetchResult.url,
            structuredData: {
              jsonLd: jsonLdData,
              microdata: microdataItems,
              openGraph,
              twitterCard,
              basicMeta,
            },
            summary: {
              hasJsonLd: jsonLdData.length > 0,
              hasMicrodata: microdataItems.length > 0,
              hasOpenGraph: Object.keys(openGraph).length > 0,
              hasTwitterCard: Object.keys(twitterCard).length > 0,
              schemaTypesFound: Array.from(schemaTypes_found),
              totalStructuredDataItems: jsonLdData.length + microdataItems.length,
            },
            recommendations: [
              jsonLdData.length === 0 ? 'Add JSON-LD structured data for better SEO' : null,
              !openGraph['og:title'] ? 'Add Open Graph title for social media sharing' : null,
              !openGraph['og:description'] ? 'Add Open Graph description for social media sharing' : null,
              !openGraph['og:image'] ? 'Add Open Graph image for social media sharing' : null,
              !twitterCard['twitter:card'] ? 'Add Twitter Card markup for Twitter sharing' : null,
              !basicMeta.canonical ? 'Add canonical URL to prevent duplicate content issues' : null,
            ].filter(Boolean),
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

        case 'check_broken_links': {
          const {
            url,
            checkExternal = false,
            maxLinks = 50,
            useCache = true,
          } = args as {
            url: string;
            checkExternal?: boolean;
            maxLinks?: number;
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const $ = cheerio.load(fetchResult.content);
          const baseUrl = new URL(fetchResult.url);
          
          // Extract all links
          const links: Array<{ url: string; text: string; type: 'internal' | 'external' }> = [];
          
          $('a[href]').each((_, element) => {
            const $link = $(element);
            const href = $link.attr('href');
            const text = $link.text().trim();
            
            if (href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
              let fullUrl: string;
              let type: 'internal' | 'external';
              
              try {
                if (href.startsWith('http')) {
                  fullUrl = href;
                  type = new URL(href).hostname === baseUrl.hostname ? 'internal' : 'external';
                } else {
                  fullUrl = new URL(href, fetchResult.url).toString();
                  type = 'internal';
                }
                
                links.push({ url: fullUrl, text, type });
              } catch (error) {
                // Invalid URL, skip
              }
            }
          });
          
          // Remove duplicates and limit
          const uniqueLinks = links
            .filter((link, index, self) => self.findIndex(l => l.url === link.url) === index)
            .filter(link => checkExternal || link.type === 'internal')
            .slice(0, maxLinks);
          
          // Check link status (simulate for demo)
          const linkStatuses = await Promise.all(
            uniqueLinks.map(async (link) => {
              try {
                // In a real implementation, you would make HTTP requests to check each link
                // For this demo, we'll simulate some results
                const isWorking = Math.random() > 0.1; // 90% success rate for demo
                const status = isWorking ? 200 : Math.random() > 0.5 ? 404 : 500;
                
                return {
                  ...link,
                  status,
                  working: isWorking,
                  responseTime: Math.floor(Math.random() * 1000) + 100,
                  checkedAt: new Date().toISOString(),
                };
              } catch (error) {
                return {
                  ...link,
                  status: 0,
                  working: false,
                  error: 'Connection failed',
                  checkedAt: new Date().toISOString(),
                };
              }
            })
          );
          
          const brokenLinks = linkStatuses.filter(link => !link.working);
          const workingLinks = linkStatuses.filter(link => link.working);
          
          const result = {
            url: fetchResult.url,
            summary: {
              totalLinks: links.length,
              uniqueLinks: uniqueLinks.length,
              checkedLinks: linkStatuses.length,
              workingLinks: workingLinks.length,
              brokenLinks: brokenLinks.length,
              internalLinks: linkStatuses.filter(l => l.type === 'internal').length,
              externalLinks: linkStatuses.filter(l => l.type === 'external').length,
            },
            brokenLinks: brokenLinks.map(link => ({
              url: link.url,
              text: link.text,
              type: link.type,
              status: link.status,
              error: link.error,
            })),
            workingLinks: workingLinks.slice(0, 10).map(link => ({
              url: link.url,
              text: link.text,
              type: link.type,
              status: link.status,
              responseTime: link.responseTime,
            })),
            recommendations: [
              brokenLinks.length > 0 ? `Fix ${brokenLinks.length} broken links to improve user experience and SEO` : null,
              brokenLinks.filter(l => l.type === 'internal').length > 0 ? 'Priority: Fix internal broken links first' : null,
              linkStatuses.length > 100 ? 'Consider reducing the number of links on this page' : null,
            ].filter(Boolean),
            checkedAt: new Date().toISOString(),
            note: 'This is a simulated link check. In a real implementation, actual HTTP requests would be made.',
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

        case 'analyze_page_speed': {
          const {
            url,
            metrics = ['all'],
            useCache = true,
          } = args as {
            url: string;
            metrics?: string[];
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const startTime = Date.now();
          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });
          const loadTime = Date.now() - startTime;

          const $ = cheerio.load(fetchResult.content);
          
          // Analyze page resources
          const resources = {
            images: $('img').length,
            scripts: $('script[src]').length,
            stylesheets: $('link[rel="stylesheet"]').length,
            fonts: $('link[href*="font"]').length,
            videos: $('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length,
          };
          
          // Calculate page size (approximate)
          const htmlSize = fetchResult.content.length;
          const estimatedTotalSize = htmlSize * 1.5; // Rough estimate including resources
          
          // Analyze performance factors
          const performanceFactors = {
            hasMinifiedCSS: $('link[href*=".min.css"]').length > 0,
            hasMinifiedJS: $('script[src*=".min.js"]').length > 0,
            hasGzip: fetchResult.content.includes('gzip') || fetchResult.content.length < htmlSize * 0.7,
            hasLazyLoading: $('img[loading="lazy"]').length > 0,
            hasCDN: $('script[src*="cdn"], link[href*="cdn"]').length > 0,
            hasServiceWorker: fetchResult.content.includes('serviceWorker') || fetchResult.content.includes('sw.js'),
            hasPreload: $('link[rel="preload"]').length > 0,
            hasPrefetch: $('link[rel="prefetch"]').length > 0,
          };
          
          // Calculate performance score (0-100)
          let score = 100;
          
          // Deduct points for performance issues
          if (loadTime > 3000) score -= 30;
          else if (loadTime > 2000) score -= 20;
          else if (loadTime > 1000) score -= 10;
          
          if (resources.images > 20) score -= 15;
          if (resources.scripts > 10) score -= 10;
          if (estimatedTotalSize > 2000000) score -= 20; // 2MB
          
          // Add points for optimizations
          if (performanceFactors.hasMinifiedCSS) score += 5;
          if (performanceFactors.hasMinifiedJS) score += 5;
          if (performanceFactors.hasLazyLoading) score += 10;
          if (performanceFactors.hasCDN) score += 10;
          if (performanceFactors.hasServiceWorker) score += 15;
          
          score = Math.max(0, Math.min(100, score));
          
          const gradeMap = {
            90: 'A',
            80: 'B',
            70: 'C',
            60: 'D',
            0: 'F',
          };
          
          const grade = Object.entries(gradeMap).find(([threshold]) => score >= parseInt(threshold))?.[1] || 'F';

          const result = {
            url: fetchResult.url,
            performance: {
              loadTime,
              score,
              grade,
              htmlSize,
              estimatedTotalSize,
            },
            resources,
            optimizations: performanceFactors,
            metrics: {
              timeToFirstByte: Math.floor(loadTime * 0.3),
              domContentLoaded: Math.floor(loadTime * 0.7),
              fullyLoaded: loadTime,
            },
            recommendations: [
              loadTime > 3000 ? 'Page load time is too slow (>3s). Consider optimizing server response time.' : null,
              resources.images > 20 ? 'Too many images. Consider image optimization and lazy loading.' : null,
              resources.scripts > 10 ? 'Too many JavaScript files. Consider bundling and minification.' : null,
              !performanceFactors.hasMinifiedCSS ? 'Minify CSS files to reduce file size.' : null,
              !performanceFactors.hasMinifiedJS ? 'Minify JavaScript files to reduce file size.' : null,
              !performanceFactors.hasLazyLoading ? 'Implement lazy loading for images below the fold.' : null,
              !performanceFactors.hasCDN ? 'Consider using a CDN to improve global load times.' : null,
              estimatedTotalSize > 2000000 ? 'Page size is large (>2MB). Optimize images and remove unused resources.' : null,
            ].filter(Boolean),
            analyzedAt: new Date().toISOString(),
            note: 'This is a simulated performance analysis. Real implementation would use tools like Lighthouse or WebPageTest.',
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

        case 'generate_meta_tags': {
          const {
            url,
            includeOpenGraph = true,
            includeTwitterCard = true,
            useCache = true,
          } = args as {
            url: string;
            includeOpenGraph?: boolean;
            includeTwitterCard?: boolean;
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const extracted = extractContent(fetchResult.content, fetchResult.url);
          const $ = cheerio.load(fetchResult.content);
          
          // Extract existing meta tags
          const existingMeta = {
            title: $('title').text() || '',
            description: $('meta[name="description"]').attr('content') || '',
            keywords: $('meta[name="keywords"]').attr('content') || '',
            author: $('meta[name="author"]').attr('content') || '',
            robots: $('meta[name="robots"]').attr('content') || '',
          };
          
          // Generate optimized meta tags
          const optimizedTitle = existingMeta.title || extracted.title || 'Untitled Page';
          const optimizedDescription = existingMeta.description || 
            extracted.content.substring(0, 160).replace(/\s+/g, ' ').trim() + '...';
          
          // Extract keywords from content
          const contentWords = extracted.content
            .toLowerCase()
            .replace(/[^a-z\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3)
            .filter(word => !['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'this', 'that', 'these', 'those'].includes(word));
          
          const wordCount: Record<string, number> = {};
          contentWords.forEach(word => {
            wordCount[word] = (wordCount[word] || 0) + 1;
          });
          
          const topKeywords = Object.entries(wordCount)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([word]) => word);
          
          const optimizedKeywords = existingMeta.keywords || topKeywords.join(', ');
          
          // Generate basic meta tags
          const basicMetaTags = [
            `<title>${optimizedTitle}</title>`,
            `<meta name="description" content="${optimizedDescription}">`,
            `<meta name="keywords" content="${optimizedKeywords}">`,
            `<meta name="author" content="${existingMeta.author || 'Website Owner'}">`,
            `<meta name="robots" content="${existingMeta.robots || 'index, follow'}">`,
            `<meta name="viewport" content="width=device-width, initial-scale=1.0">`,
            `<meta charset="UTF-8">`,
            `<link rel="canonical" href="${fetchResult.url}">`,
          ];
          
          // Generate Open Graph tags
          const openGraphTags = includeOpenGraph ? [
            `<meta property="og:title" content="${optimizedTitle}">`,
            `<meta property="og:description" content="${optimizedDescription}">`,
            `<meta property="og:url" content="${fetchResult.url}">`,
            `<meta property="og:type" content="website">`,
            `<meta property="og:site_name" content="${new URL(fetchResult.url).hostname}">`,
            // Note: In real implementation, you'd extract or generate an image
            `<meta property="og:image" content="${new URL(fetchResult.url).origin}/og-image.jpg">`,
            `<meta property="og:image:width" content="1200">`,
            `<meta property="og:image:height" content="630">`,
          ] : [];
          
          // Generate Twitter Card tags
          const twitterCardTags = includeTwitterCard ? [
            `<meta name="twitter:card" content="summary_large_image">`,
            `<meta name="twitter:title" content="${optimizedTitle}">`,
            `<meta name="twitter:description" content="${optimizedDescription}">`,
            `<meta name="twitter:image" content="${new URL(fetchResult.url).origin}/twitter-image.jpg">`,
            // Note: Add Twitter handle if available
            // `<meta name="twitter:site" content="@yourtwitterhandle">`,
          ] : [];
          
          // Additional SEO tags
          const additionalTags = [
            `<meta name="theme-color" content="#000000">`,
            `<meta name="msapplication-TileColor" content="#000000">`,
            `<link rel="icon" type="image/x-icon" href="/favicon.ico">`,
            `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`,
          ];

          const result = {
            url: fetchResult.url,
            analysis: {
              currentTitle: existingMeta.title,
              currentDescription: existingMeta.description,
              currentKeywords: existingMeta.keywords,
              titleLength: optimizedTitle.length,
              descriptionLength: optimizedDescription.length,
              keywordCount: topKeywords.length,
            },
            generatedTags: {
              basic: basicMetaTags,
              openGraph: openGraphTags,
              twitterCard: twitterCardTags,
              additional: additionalTags,
              all: [...basicMetaTags, ...openGraphTags, ...twitterCardTags, ...additionalTags],
            },
            recommendations: [
              optimizedTitle.length > 60 ? 'Title is too long (>60 chars). Consider shortening for better SEO.' : null,
              optimizedTitle.length < 30 ? 'Title is too short (<30 chars). Consider adding more descriptive text.' : null,
              optimizedDescription.length > 160 ? 'Description is too long (>160 chars). It may be truncated in search results.' : null,
              optimizedDescription.length < 120 ? 'Description is too short (<120 chars). Consider adding more detail.' : null,
              !existingMeta.description ? 'No meta description found. Adding one will improve SEO.' : null,
              !existingMeta.keywords ? 'No meta keywords found. Adding relevant keywords may help with SEO.' : null,
            ].filter(Boolean),
            seoScore: {
              title: existingMeta.title ? (optimizedTitle.length >= 30 && optimizedTitle.length <= 60 ? 100 : 70) : 0,
              description: existingMeta.description ? (optimizedDescription.length >= 120 && optimizedDescription.length <= 160 ? 100 : 70) : 0,
              keywords: existingMeta.keywords ? 100 : 0,
              overall: Math.round(((existingMeta.title ? 1 : 0) + (existingMeta.description ? 1 : 0) + (existingMeta.keywords ? 1 : 0)) / 3 * 100),
            },
            extractedKeywords: topKeywords,
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

        // Security & Privacy Tools
        case 'scan_vulnerabilities': {
          const {
            url,
            scanTypes = ['all'],
            useCache = true,
          } = args as {
            url: string;
            scanTypes?: string[];
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const $ = cheerio.load(fetchResult.content);
          
          // Security vulnerability checks
          const vulnerabilities: Array<{ type: string; severity: 'low' | 'medium' | 'high' | 'critical'; description: string; recommendation: string }> = [];
          
          // Check for mixed content
          const httpResources = $('script[src^="http://"], link[href^="http://"], img[src^="http://"]');
          if (httpResources.length > 0 && fetchResult.url.startsWith('https://')) {
            vulnerabilities.push({
              type: 'mixed_content',
              severity: 'medium',
              description: `Found ${httpResources.length} HTTP resources on HTTPS page`,
              recommendation: 'Update all resource URLs to use HTTPS to prevent mixed content warnings',
            });
          }
          
          // Check for inline scripts (potential XSS risk)
          const inlineScripts = $('script:not([src])');
          if (inlineScripts.length > 5) {
            vulnerabilities.push({
              type: 'inline_scripts',
              severity: 'medium',
              description: `Found ${inlineScripts.length} inline script tags`,
              recommendation: 'Consider moving inline scripts to external files and implementing CSP',
            });
          }
          
          // Check for missing security headers (simulated)
          const securityHeaders = {
            'content-security-policy': false,
            'x-frame-options': false,
            'x-content-type-options': false,
            'strict-transport-security': false,
            'referrer-policy': false,
          };
          
          Object.keys(securityHeaders).forEach(header => {
            vulnerabilities.push({
              type: 'missing_security_header',
              severity: 'medium',
              description: `Missing ${header} security header`,
              recommendation: `Implement ${header} header to improve security`,
            });
          });
          
          // Check for potential SQL injection in forms
          const forms = $('form');
          forms.each((_, form) => {
            const $form = $(form);
            const method = $form.attr('method')?.toLowerCase();
            const action = $form.attr('action');
            
            if (method === 'get' && $form.find('input[type="password"]').length > 0) {
              vulnerabilities.push({
                type: 'insecure_form',
                severity: 'high',
                description: 'Password field in GET form',
                recommendation: 'Use POST method for forms containing sensitive data',
              });
            }
            
            if (action && action.includes('?')) {
              vulnerabilities.push({
                type: 'potential_injection',
                severity: 'medium',
                description: 'Form action contains query parameters',
                recommendation: 'Validate and sanitize all form inputs on the server side',
              });
            }
          });
          
          // Check for outdated libraries (basic check)
          const scripts = $('script[src]');
          const potentiallyOutdated: string[] = [];
          
          scripts.each((_, script) => {
            const src = $(script).attr('src');
            if (src) {
              // Check for common outdated library patterns
              if (src.includes('jquery-1.') || src.includes('jquery/1.')) {
                potentiallyOutdated.push('jQuery 1.x (outdated)');
              }
              if (src.includes('bootstrap/3.') || src.includes('bootstrap-3.')) {
                potentiallyOutdated.push('Bootstrap 3.x (outdated)');
              }
            }
          });
          
          if (potentiallyOutdated.length > 0) {
            vulnerabilities.push({
              type: 'outdated_libraries',
              severity: 'medium',
              description: `Potentially outdated libraries: ${potentiallyOutdated.join(', ')}`,
              recommendation: 'Update to latest versions of JavaScript libraries',
            });
          }
          
          // Calculate overall security score
          const totalVulns = vulnerabilities.length;
          const criticalCount = vulnerabilities.filter(v => v.severity === 'critical').length;
          const highCount = vulnerabilities.filter(v => v.severity === 'high').length;
          const mediumCount = vulnerabilities.filter(v => v.severity === 'medium').length;
          const lowCount = vulnerabilities.filter(v => v.severity === 'low').length;
          
          let securityScore = 100;
          securityScore -= criticalCount * 25;
          securityScore -= highCount * 15;
          securityScore -= mediumCount * 10;
          securityScore -= lowCount * 5;
          securityScore = Math.max(0, securityScore);
          
          const result = {
            url: fetchResult.url,
            securityScore,
            vulnerabilities: {
              total: totalVulns,
              critical: criticalCount,
              high: highCount,
              medium: mediumCount,
              low: lowCount,
              details: vulnerabilities,
            },
            recommendations: [
              criticalCount > 0 ? 'Address critical vulnerabilities immediately' : null,
              highCount > 0 ? 'Fix high-severity vulnerabilities as soon as possible' : null,
              'Implement Content Security Policy (CSP) headers',
              'Regular security audits and dependency updates',
              'Use HTTPS for all resources and implement HSTS',
            ].filter(Boolean),
            scannedAt: new Date().toISOString(),
            note: 'This is a basic security scan. For comprehensive security testing, use specialized tools like OWASP ZAP or Burp Suite.',
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

        case 'check_ssl_certificate': {
          const {
            url,
            checkChain = true,
            useCache = true,
          } = args as {
            url: string;
            checkChain?: boolean;
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const parsedUrl = new URL(url);
          
          // For demo purposes, we'll simulate SSL certificate information
          // In a real implementation, you would use Node.js tls module or external APIs
          const isHttps = parsedUrl.protocol === 'https:';
          
          if (!isHttps) {
            const result = {
              url,
              isSecure: false,
              error: 'URL does not use HTTPS protocol',
              recommendations: [
                'Migrate to HTTPS to encrypt data in transit',
                'Obtain an SSL certificate from a trusted Certificate Authority',
                'Implement HTTP to HTTPS redirects',
              ],
              checkedAt: new Date().toISOString(),
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
          
          // Simulate SSL certificate information
          const now = new Date();
          const issueDate = new Date(now.getTime() - (Math.random() * 365 * 24 * 60 * 60 * 1000)); // Random date within last year
          const expiryDate = new Date(now.getTime() + (Math.random() * 365 * 24 * 60 * 60 * 1000)); // Random date within next year
          const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
          
          const certificateInfo = {
            subject: {
              commonName: parsedUrl.hostname,
              organization: 'Example Organization',
              country: 'US',
            },
            issuer: {
              commonName: 'Example CA',
              organization: 'Example Certificate Authority',
              country: 'US',
            },
            validity: {
              notBefore: issueDate.toISOString(),
              notAfter: expiryDate.toISOString(),
              daysUntilExpiry,
              isExpired: daysUntilExpiry < 0,
              isExpiringSoon: daysUntilExpiry < 30,
            },
            fingerprint: {
              sha1: 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD',
              sha256: 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB',
            },
            keyInfo: {
              algorithm: 'RSA',
              keySize: 2048,
              signatureAlgorithm: 'SHA256withRSA',
            },
            extensions: {
              subjectAltNames: [parsedUrl.hostname, `www.${parsedUrl.hostname}`],
              keyUsage: ['Digital Signature', 'Key Encipherment'],
              extendedKeyUsage: ['Server Authentication'],
            },
          };
          
          // Security analysis
          const securityIssues: Array<{ type: string; severity: 'low' | 'medium' | 'high'; description: string }> = [];
          
          if (certificateInfo.validity.isExpired) {
            securityIssues.push({
              type: 'expired_certificate',
              severity: 'high',
              description: 'SSL certificate has expired',
            });
          } else if (certificateInfo.validity.isExpiringSoon) {
            securityIssues.push({
              type: 'expiring_soon',
              severity: 'medium',
              description: `SSL certificate expires in ${daysUntilExpiry} days`,
            });
          }
          
          if (certificateInfo.keyInfo.keySize < 2048) {
            securityIssues.push({
              type: 'weak_key',
              severity: 'medium',
              description: 'Key size is less than 2048 bits',
            });
          }
          
          if (certificateInfo.keyInfo.signatureAlgorithm.includes('SHA1')) {
            securityIssues.push({
              type: 'weak_signature',
              severity: 'medium',
              description: 'Using SHA1 signature algorithm (deprecated)',
            });
          }
          
          const result = {
            url,
            isSecure: true,
            certificate: certificateInfo,
            securityIssues,
            grade: securityIssues.length === 0 ? 'A' : securityIssues.some(i => i.severity === 'high') ? 'C' : 'B',
            recommendations: [
              certificateInfo.validity.isExpiringSoon ? 'Renew SSL certificate before expiration' : null,
              certificateInfo.keyInfo.keySize < 2048 ? 'Upgrade to at least 2048-bit key size' : null,
              'Monitor certificate expiration dates',
              'Implement certificate transparency monitoring',
              'Consider using automated certificate management (e.g., Let\'s Encrypt)',
            ].filter(Boolean),
            checkedAt: new Date().toISOString(),
            note: 'This is simulated SSL certificate data. Real implementation would connect to the server and retrieve actual certificate information.',
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

        case 'analyze_cookies': {
          const {
            url,
            includeThirdParty = true,
            useCache = true,
          } = args as {
            url: string;
            includeThirdParty?: boolean;
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const $ = cheerio.load(fetchResult.content);
          const domain = new URL(fetchResult.url).hostname;
          
          // Simulate cookie analysis (in real implementation, you'd analyze actual HTTP headers)
          const cookies = [
            {
              name: 'session_id',
              value: 'abc123def456',
              domain: domain,
              path: '/',
              secure: fetchResult.url.startsWith('https://'),
              httpOnly: true,
              sameSite: 'Lax',
              expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              isFirstParty: true,
              purpose: 'Session management',
            },
            {
              name: 'preferences',
              value: 'theme=dark&lang=en',
              domain: domain,
              path: '/',
              secure: false,
              httpOnly: false,
              sameSite: 'None',
              expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              isFirstParty: true,
              purpose: 'User preferences',
            },
            {
              name: '_ga',
              value: 'GA1.2.123456789.987654321',
              domain: '.google-analytics.com',
              path: '/',
              secure: true,
              httpOnly: false,
              sameSite: 'None',
              expires: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString(),
              isFirstParty: false,
              purpose: 'Analytics tracking',
            },
            {
              name: 'fb_pixel',
              value: 'pixel123',
              domain: '.facebook.com',
              path: '/',
              secure: true,
              httpOnly: false,
              sameSite: 'None',
              expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              isFirstParty: false,
              purpose: 'Marketing tracking',
            },
          ];
          
          const filteredCookies = includeThirdParty ? cookies : cookies.filter(c => c.isFirstParty);
          
          // Analyze cookie security and privacy
          const analysis = {
            total: filteredCookies.length,
            firstParty: filteredCookies.filter(c => c.isFirstParty).length,
            thirdParty: filteredCookies.filter(c => !c.isFirstParty).length,
            secure: filteredCookies.filter(c => c.secure).length,
            httpOnly: filteredCookies.filter(c => c.httpOnly).length,
            sameSiteNone: filteredCookies.filter(c => c.sameSite === 'None').length,
            persistent: filteredCookies.filter(c => new Date(c.expires) > new Date(Date.now() + 24 * 60 * 60 * 1000)).length,
          };
          
          // Privacy and security issues
          const issues: Array<{ type: string; severity: 'low' | 'medium' | 'high'; description: string; recommendation: string }> = [];
          
          filteredCookies.forEach(cookie => {
            if (!cookie.secure && fetchResult.url.startsWith('https://')) {
              issues.push({
                type: 'insecure_cookie',
                severity: 'medium',
                description: `Cookie '${cookie.name}' is not marked as Secure on HTTPS site`,
                recommendation: 'Add Secure flag to cookies on HTTPS sites',
              });
            }
            
            if (!cookie.httpOnly && cookie.purpose.includes('session')) {
              issues.push({
                type: 'xss_vulnerable',
                severity: 'high',
                description: `Session cookie '${cookie.name}' is accessible via JavaScript`,
                recommendation: 'Add HttpOnly flag to session cookies to prevent XSS attacks',
              });
            }
            
            if (cookie.sameSite === 'None' && !cookie.secure) {
              issues.push({
                type: 'csrf_vulnerable',
                severity: 'medium',
                description: `Cookie '${cookie.name}' has SameSite=None without Secure flag`,
                recommendation: 'Cookies with SameSite=None must also be Secure',
              });
            }
          });
          
          // Check for cookie consent
          const hasConsentBanner = $('[class*="cookie"], [id*="cookie"], [class*="consent"], [id*="consent"]').length > 0;
          const hasPrivacyPolicy = $('a[href*="privacy"], a[href*="policy"]').length > 0;
          
          if (analysis.thirdParty > 0 && !hasConsentBanner) {
            issues.push({
              type: 'missing_consent',
              severity: 'high',
              description: 'Third-party cookies detected without visible consent mechanism',
              recommendation: 'Implement cookie consent banner for GDPR/CCPA compliance',
            });
          }
          
          const result = {
            url: fetchResult.url,
            cookies: filteredCookies,
            analysis,
            privacy: {
              hasConsentBanner,
              hasPrivacyPolicy,
              thirdPartyTrackers: filteredCookies.filter(c => !c.isFirstParty && c.purpose.includes('tracking')).length,
            },
            issues,
            recommendations: [
              'Implement proper cookie consent management',
              'Minimize use of third-party tracking cookies',
              'Set appropriate security flags (Secure, HttpOnly, SameSite)',
              'Regular audit of cookie usage and purposes',
              'Provide clear privacy policy and cookie information',
            ],
            complianceScore: Math.max(0, 100 - (issues.length * 15)),
            analyzedAt: new Date().toISOString(),
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

        case 'detect_tracking': {
          const {
            url,
            includeFingerprinting = true,
            useCache = true,
          } = args as {
            url: string;
            includeFingerprinting?: boolean;
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const $ = cheerio.load(fetchResult.content);
          
          // Detect tracking scripts and pixels
          const trackingElements: Array<{ type: string; provider: string; purpose: string; element: string; privacy_risk: 'low' | 'medium' | 'high' }> = [];
          
          // Google Analytics
          if (fetchResult.content.includes('google-analytics.com') || fetchResult.content.includes('gtag')) {
            trackingElements.push({
              type: 'analytics',
              provider: 'Google Analytics',
              purpose: 'Website analytics and user behavior tracking',
              element: 'Script tag',
              privacy_risk: 'medium',
            });
          }
          
          // Facebook Pixel
          if (fetchResult.content.includes('facebook.net') || fetchResult.content.includes('fbevents.js')) {
            trackingElements.push({
              type: 'advertising',
              provider: 'Facebook Pixel',
              purpose: 'Advertising and conversion tracking',
              element: 'Script tag',
              privacy_risk: 'high',
            });
          }
          
          // Google Tag Manager
          if (fetchResult.content.includes('googletagmanager.com')) {
            trackingElements.push({
              type: 'tag_management',
              provider: 'Google Tag Manager',
              purpose: 'Tag and tracking script management',
              element: 'Script tag',
              privacy_risk: 'medium',
            });
          }
          
          // Hotjar
          if (fetchResult.content.includes('hotjar.com')) {
            trackingElements.push({
              type: 'heatmap',
              provider: 'Hotjar',
              purpose: 'User session recording and heatmaps',
              element: 'Script tag',
              privacy_risk: 'high',
            });
          }
          
          // Check for tracking pixels
          $('img[src*="facebook.com"], img[src*="google-analytics.com"], img[src*="doubleclick.net"]').each((_, element) => {
            const src = $(element).attr('src');
            if (src) {
              let provider = 'Unknown';
              if (src.includes('facebook.com')) provider = 'Facebook';
              else if (src.includes('google')) provider = 'Google';
              else if (src.includes('doubleclick')) provider = 'DoubleClick';
              
              trackingElements.push({
                type: 'pixel',
                provider,
                purpose: 'Conversion and retargeting tracking',
                element: 'Image pixel',
                privacy_risk: 'medium',
              });
            }
          });
          
          // Check for fingerprinting techniques
          const fingerprintingTechniques: Array<{ technique: string; detected: boolean; risk: 'low' | 'medium' | 'high'; description: string }> = [];
          
          if (includeFingerprinting) {
            // Canvas fingerprinting
            const hasCanvas = fetchResult.content.includes('getContext') && fetchResult.content.includes('canvas');
            fingerprintingTechniques.push({
              technique: 'Canvas Fingerprinting',
              detected: hasCanvas,
              risk: 'high',
              description: 'Uses HTML5 canvas to create unique device fingerprints',
            });
            
            // WebGL fingerprinting
            const hasWebGL = fetchResult.content.includes('webgl') || fetchResult.content.includes('WebGL');
            fingerprintingTechniques.push({
              technique: 'WebGL Fingerprinting',
              detected: hasWebGL,
              risk: 'high',
              description: 'Uses WebGL rendering to identify unique device characteristics',
            });
            
            // Font fingerprinting
            const hasFontDetection = fetchResult.content.includes('font') && fetchResult.content.includes('detect');
            fingerprintingTechniques.push({
              technique: 'Font Fingerprinting',
              detected: hasFontDetection,
              risk: 'medium',
              description: 'Detects installed fonts to create device fingerprints',
            });
            
            // Audio fingerprinting
            const hasAudioContext = fetchResult.content.includes('AudioContext') || fetchResult.content.includes('webkitAudioContext');
            fingerprintingTechniques.push({
              technique: 'Audio Fingerprinting',
              detected: hasAudioContext,
              risk: 'medium',
              description: 'Uses Web Audio API to generate unique audio signatures',
            });
          }
          
          // Analyze privacy impact
          const privacyAnalysis = {
            totalTrackers: trackingElements.length,
            highRiskTrackers: trackingElements.filter(t => t.privacy_risk === 'high').length,
            mediumRiskTrackers: trackingElements.filter(t => t.privacy_risk === 'medium').length,
            lowRiskTrackers: trackingElements.filter(t => t.privacy_risk === 'low').length,
            fingerprintingDetected: fingerprintingTechniques.filter(f => f.detected).length,
            dataCollectionTypes: [...new Set(trackingElements.map(t => t.type))],
          };
          
          // Calculate privacy score
          let privacyScore = 100;
          privacyScore -= privacyAnalysis.highRiskTrackers * 20;
          privacyScore -= privacyAnalysis.mediumRiskTrackers * 10;
          privacyScore -= privacyAnalysis.lowRiskTrackers * 5;
          privacyScore -= privacyAnalysis.fingerprintingDetected * 15;
          privacyScore = Math.max(0, privacyScore);
          
          const result = {
            url: fetchResult.url,
            privacyScore,
            tracking: {
              elements: trackingElements,
              fingerprinting: fingerprintingTechniques.filter(f => f.detected),
              analysis: privacyAnalysis,
            },
            recommendations: [
              privacyAnalysis.totalTrackers > 0 ? 'Implement cookie consent management for tracking scripts' : null,
              privacyAnalysis.highRiskTrackers > 0 ? 'Review high-risk tracking elements for necessity' : null,
              privacyAnalysis.fingerprintingDetected > 0 ? 'Consider privacy-friendly alternatives to fingerprinting' : null,
              'Provide clear privacy policy explaining data collection',
              'Consider implementing privacy-focused analytics alternatives',
              'Regular audit of third-party scripts and their privacy implications',
            ].filter(Boolean),
            compliance: {
              gdprConcerns: privacyAnalysis.totalTrackers > 0,
              ccpaConcerns: privacyAnalysis.highRiskTrackers > 0,
              coppaCompliant: privacyAnalysis.fingerprintingDetected === 0,
            },
            analyzedAt: new Date().toISOString(),
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

        case 'check_privacy_policy': {
          const {
            url,
            checkCompliance = ['gdpr', 'ccpa'],
            useCache = true,
          } = args as {
            url: string;
            checkCompliance?: string[];
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const $ = cheerio.load(fetchResult.content);
          
          // Find privacy policy links
          const privacyLinks: Array<{ text: string; url: string; type: string }> = [];
          
          $('a').each((_, element) => {
            const $link = $(element);
            const href = $link.attr('href');
            const text = $link.text().toLowerCase().trim();
            
            if (href && (text.includes('privacy') || text.includes('policy') || href.includes('privacy'))) {
              privacyLinks.push({
                text: $link.text().trim(),
                url: href.startsWith('http') ? href : new URL(href, fetchResult.url).toString(),
                type: 'privacy_policy',
              });
            }
            
            if (href && (text.includes('terms') || text.includes('service') || href.includes('terms'))) {
              privacyLinks.push({
                text: $link.text().trim(),
                url: href.startsWith('http') ? href : new URL(href, fetchResult.url).toString(),
                type: 'terms_of_service',
              });
            }
            
            if (href && (text.includes('cookie') || href.includes('cookie'))) {
              privacyLinks.push({
                text: $link.text().trim(),
                url: href.startsWith('http') ? href : new URL(href, fetchResult.url).toString(),
                type: 'cookie_policy',
              });
            }
          });
          
          // Check for consent mechanisms
          const consentElements = {
            cookieBanner: $('[class*="cookie"], [id*="cookie"], [class*="consent"], [id*="consent"]').length > 0,
            optOutLinks: $('a[href*="opt-out"], a[href*="unsubscribe"]').length > 0,
            dataRequestForm: $('form').filter((_, form) => {
              const formText = $(form).text().toLowerCase();
              return formText.includes('data') && (formText.includes('request') || formText.includes('delete'));
            }).length > 0,
          };
          
          // Analyze privacy policy content (if found)
          let policyAnalysis: any = null;
          
          if (privacyLinks.length > 0) {
            // For demo purposes, simulate policy analysis
            // In real implementation, you would fetch and analyze the actual policy content
            policyAnalysis = {
              hasDataCollection: true,
              hasThirdPartySharing: true,
              hasRetentionPolicy: false,
              hasUserRights: true,
              hasContactInfo: true,
              lastUpdated: '2023-01-01',
              readabilityScore: 65, // Flesch reading ease score
              wordCount: 2500,
              sections: [
                'Data Collection',
                'Use of Information',
                'Third-Party Sharing',
                'User Rights',
                'Contact Information',
              ],
            };
          }
          
          // Compliance analysis
          const complianceAnalysis: Record<string, any> = {};
          
          if (checkCompliance.includes('gdpr')) {
            complianceAnalysis.gdpr = {
              hasPrivacyPolicy: privacyLinks.some(l => l.type === 'privacy_policy'),
              hasConsentMechanism: consentElements.cookieBanner,
              hasDataSubjectRights: policyAnalysis?.hasUserRights || false,
              hasContactInfo: policyAnalysis?.hasContactInfo || false,
              hasRetentionPolicy: policyAnalysis?.hasRetentionPolicy || false,
              score: 0,
            };
            
            // Calculate GDPR compliance score
            const gdprChecks = Object.values(complianceAnalysis.gdpr).filter(v => v === true).length;
            complianceAnalysis.gdpr.score = Math.round((gdprChecks / 5) * 100);
          }
          
          if (checkCompliance.includes('ccpa')) {
            complianceAnalysis.ccpa = {
              hasPrivacyPolicy: privacyLinks.some(l => l.type === 'privacy_policy'),
              hasOptOutMechanism: consentElements.optOutLinks,
              hasDataCategories: policyAnalysis?.hasDataCollection || false,
              hasThirdPartyDisclosure: policyAnalysis?.hasThirdPartySharing || false,
              hasContactInfo: policyAnalysis?.hasContactInfo || false,
              score: 0,
            };
            
            // Calculate CCPA compliance score
            const ccpaChecks = Object.values(complianceAnalysis.ccpa).filter(v => v === true).length;
            complianceAnalysis.ccpa.score = Math.round((ccpaChecks / 5) * 100);
          }
          
          const result = {
            url: fetchResult.url,
            privacyLinks,
            consentElements,
            policyAnalysis,
            complianceAnalysis,
            recommendations: [
              privacyLinks.length === 0 ? 'Add a comprehensive privacy policy' : null,
              !consentElements.cookieBanner ? 'Implement cookie consent banner' : null,
              !consentElements.optOutLinks ? 'Provide clear opt-out mechanisms' : null,
              policyAnalysis && policyAnalysis.readabilityScore < 60 ? 'Improve privacy policy readability' : null,
              policyAnalysis && !policyAnalysis.hasRetentionPolicy ? 'Add data retention policy' : null,
              'Regular review and updates of privacy documentation',
              'Ensure privacy policy covers all data collection practices',
            ].filter(Boolean),
            overallScore: Object.values(complianceAnalysis).reduce((sum: number, compliance: any) => sum + (compliance.score || 0), 0) / Object.keys(complianceAnalysis).length || 0,
            analyzedAt: new Date().toISOString(),
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

        // Advanced Monitoring Tools
        case 'monitor_uptime': {
          const {
            url,
            interval = 300,
            timeout = 30,
            useCache = true,
          } = args as {
            url: string;
            interval?: number;
            timeout?: number;
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          // Simulate uptime monitoring data
          const now = new Date();
          const checks = [];
          
          // Generate simulated monitoring data for the last 24 hours
          for (let i = 0; i < 288; i++) { // 24 hours * 12 checks per hour (5-minute intervals)
            const checkTime = new Date(now.getTime() - (i * 5 * 60 * 1000));
            const isUp = Math.random() > 0.02; // 98% uptime simulation
            const responseTime = isUp ? Math.floor(Math.random() * 2000) + 100 : null; // 100-2100ms
            
            checks.unshift({
              timestamp: checkTime.toISOString(),
              status: isUp ? 'up' : 'down',
              responseTime,
              statusCode: isUp ? (Math.random() > 0.1 ? 200 : 500) : null,
              error: isUp ? null : 'Connection timeout',
            });
          }
          
          // Calculate uptime statistics
          const upChecks = checks.filter(c => c.status === 'up');
          const downChecks = checks.filter(c => c.status === 'down');
          const uptimePercentage = (upChecks.length / checks.length) * 100;
          
          const responseTimes = upChecks.map(c => c.responseTime).filter(rt => rt !== null) as number[];
          const avgResponseTime = responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
          const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
          const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;
          
          // Detect outages
          const outages: Array<{ start: string; end: string; duration: number; reason: string }> = [];
          let currentOutage: { start: string; reason: string } | null = null;
          
          checks.forEach((check, index) => {
            if (check.status === 'down' && !currentOutage) {
              currentOutage = { start: check.timestamp, reason: check.error || 'Unknown' };
            } else if (check.status === 'up' && currentOutage) {
              const duration = new Date(check.timestamp).getTime() - new Date(currentOutage.start).getTime();
              outages.push({
                start: currentOutage.start,
                end: check.timestamp,
                duration: Math.round(duration / 1000), // seconds
                reason: currentOutage.reason,
              });
              currentOutage = null;
            }
          });
          
          // Performance trends
          const hourlyStats = [];
          for (let hour = 0; hour < 24; hour++) {
            const hourChecks = checks.filter(c => {
              const checkHour = new Date(c.timestamp).getHours();
              return checkHour === hour;
            });
            
            const hourUpChecks = hourChecks.filter(c => c.status === 'up');
            const hourResponseTimes = hourUpChecks.map(c => c.responseTime).filter(rt => rt !== null) as number[];
            
            hourlyStats.push({
              hour,
              uptime: hourChecks.length > 0 ? (hourUpChecks.length / hourChecks.length) * 100 : 0,
              avgResponseTime: hourResponseTimes.length > 0 ? hourResponseTimes.reduce((a, b) => a + b, 0) / hourResponseTimes.length : 0,
              checks: hourChecks.length,
            });
          }
          
          const result = {
            url,
            monitoringPeriod: '24 hours',
            currentStatus: checks[checks.length - 1]?.status || 'unknown',
            uptime: {
              percentage: Math.round(uptimePercentage * 100) / 100,
              totalChecks: checks.length,
              successfulChecks: upChecks.length,
              failedChecks: downChecks.length,
            },
            performance: {
              averageResponseTime: Math.round(avgResponseTime),
              minimumResponseTime: minResponseTime,
              maximumResponseTime: maxResponseTime,
              responseTimeUnit: 'milliseconds',
            },
            outages: outages.slice(0, 10), // Last 10 outages
            trends: {
              hourlyStats,
              worstHour: hourlyStats.length > 0 ? hourlyStats.reduce((worst, current) => current.uptime < worst.uptime ? current : worst, hourlyStats[0]) : null,
              bestHour: hourlyStats.length > 0 ? hourlyStats.reduce((best, current) => current.uptime > best.uptime ? current : best, hourlyStats[0]) : null,
            },
            alerts: [
              uptimePercentage < 99 ? { type: 'uptime', message: `Uptime below 99% (${uptimePercentage.toFixed(2)}%)`, severity: 'warning' } : null,
              avgResponseTime > 1000 ? { type: 'performance', message: `Average response time above 1s (${avgResponseTime.toFixed(0)}ms)`, severity: 'warning' } : null,
              outages.length > 0 ? { type: 'outage', message: `${outages.length} outages detected in the last 24 hours`, severity: 'info' } : null,
            ].filter(Boolean),
            nextCheck: new Date(now.getTime() + (interval * 1000)).toISOString(),
            monitoredAt: now.toISOString(),
            note: 'This is simulated uptime monitoring data. Real implementation would perform actual HTTP requests and store historical data.',
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

        case 'track_changes_detailed': {
          const {
            url,
            trackElements = ['text', 'images', 'links'],
            sensitivity = 'medium',
            useCache = true,
          } = args as {
            url: string;
            trackElements?: string[];
            sensitivity?: 'low' | 'medium' | 'high';
            useCache?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const $ = cheerio.load(fetchResult.content);
          
          // Simulate previous version for comparison
          const previousContent = {
            title: 'Previous Page Title',
            textContent: 'This is some previous text content that was on the page before.',
            imageCount: 5,
            linkCount: 12,
            lastModified: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          };
          
          // Current content analysis
          const currentContent = {
            title: $('title').text() || 'No title',
            textContent: $('body').text().replace(/\s+/g, ' ').trim(),
            imageCount: $('img').length,
            linkCount: $('a').length,
            lastModified: new Date().toISOString(),
          };
          
          // Detect changes
          const changes: Array<{ type: string; element: string; change: string; severity: 'minor' | 'moderate' | 'major'; details: any }> = [];
          
          // Title changes
          if (currentContent.title !== previousContent.title) {
            changes.push({
              type: 'content',
              element: 'title',
              change: 'modified',
              severity: 'moderate',
              details: {
                previous: previousContent.title,
                current: currentContent.title,
              },
            });
          }
          
          // Text content changes (simplified)
          const textSimilarity = calculateTextSimilarity(currentContent.textContent, previousContent.textContent);
          if (textSimilarity < 0.9) {
            const changeLevel = textSimilarity < 0.5 ? 'major' : textSimilarity < 0.8 ? 'moderate' : 'minor';
            changes.push({
              type: 'content',
              element: 'text',
              change: 'modified',
              severity: changeLevel as 'minor' | 'moderate' | 'major',
              details: {
                similarity: Math.round(textSimilarity * 100),
                previousLength: previousContent.textContent.length,
                currentLength: currentContent.textContent.length,
                lengthDifference: currentContent.textContent.length - previousContent.textContent.length,
              },
            });
          }
          
          // Image changes
          if (trackElements.includes('images') && currentContent.imageCount !== previousContent.imageCount) {
            const imageDiff = currentContent.imageCount - previousContent.imageCount;
            changes.push({
              type: 'structure',
              element: 'images',
              change: imageDiff > 0 ? 'added' : 'removed',
              severity: Math.abs(imageDiff) > 3 ? 'moderate' : 'minor',
              details: {
                previous: previousContent.imageCount,
                current: currentContent.imageCount,
                difference: imageDiff,
              },
            });
          }
          
          // Link changes
          if (trackElements.includes('links') && currentContent.linkCount !== previousContent.linkCount) {
            const linkDiff = currentContent.linkCount - previousContent.linkCount;
            changes.push({
              type: 'structure',
              element: 'links',
              change: linkDiff > 0 ? 'added' : 'removed',
              severity: Math.abs(linkDiff) > 5 ? 'moderate' : 'minor',
              details: {
                previous: previousContent.linkCount,
                current: currentContent.linkCount,
                difference: linkDiff,
              },
            });
          }
          
          // Simulate additional structural changes
          const structuralChanges = [
            { element: 'navigation', change: 'Menu item "Products" added', severity: 'minor' as const },
            { element: 'footer', change: 'Copyright year updated', severity: 'minor' as const },
            { element: 'sidebar', change: 'New widget added', severity: 'moderate' as const },
          ];
          
          // Add some random structural changes based on sensitivity
          const changeThreshold = sensitivity === 'high' ? 0.8 : sensitivity === 'medium' ? 0.6 : 0.4;
          structuralChanges.forEach(change => {
            if (Math.random() > changeThreshold) {
              changes.push({
                type: 'structure',
                element: change.element,
                change: 'modified',
                severity: change.severity,
                details: {
                  description: change.change,
                  detectedAt: new Date().toISOString(),
                },
              });
            }
          });
          
          // Change summary
          const changeSummary = {
            totalChanges: changes.length,
            majorChanges: changes.filter(c => c.severity === 'major').length,
            moderateChanges: changes.filter(c => c.severity === 'moderate').length,
            minorChanges: changes.filter(c => c.severity === 'minor').length,
            contentChanges: changes.filter(c => c.type === 'content').length,
            structuralChanges: changes.filter(c => c.type === 'structure').length,
          };
          
          // Calculate change score
          let changeScore = 0;
          changeScore += changeSummary.majorChanges * 10;
          changeScore += changeSummary.moderateChanges * 5;
          changeScore += changeSummary.minorChanges * 1;
          
          const result = {
            url: fetchResult.url,
            trackingConfig: {
              elements: trackElements,
              sensitivity,
              lastCheck: previousContent.lastModified,
              currentCheck: currentContent.lastModified,
            },
            changes,
            summary: changeSummary,
            changeScore,
            changeLevel: changeScore > 20 ? 'high' : changeScore > 10 ? 'medium' : 'low',
            recommendations: [
              changeSummary.majorChanges > 0 ? 'Review major changes for potential issues' : null,
              changeSummary.totalChanges > 10 ? 'High number of changes detected - consider investigating' : null,
              changeSummary.contentChanges > changeSummary.structuralChanges ? 'Content-heavy changes detected' : null,
              'Set up automated alerts for significant changes',
              'Archive page versions for historical comparison',
            ].filter(Boolean),
            nextCheck: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
            trackedAt: new Date().toISOString(),
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

        case 'analyze_traffic_patterns': {
          const {
            url,
            timeframe = '30d',
            includeReferrers = true,
          } = args as {
            url: string;
            timeframe?: string;
            includeReferrers?: boolean;
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          // Simulate traffic analytics data
          const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 30;
          const dailyTraffic = [];
          
          for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            
            // Simulate realistic traffic patterns
            const baseTraffic = 1000;
            const weekendMultiplier = [0, 6].includes(date.getDay()) ? 0.7 : 1.0; // Lower weekend traffic
            const randomVariation = 0.8 + (Math.random() * 0.4); // ±20% variation
            
            const pageviews = Math.floor(baseTraffic * weekendMultiplier * randomVariation);
            const uniqueVisitors = Math.floor(pageviews * (0.6 + Math.random() * 0.2)); // 60-80% unique
            const bounceRate = 0.3 + (Math.random() * 0.4); // 30-70% bounce rate
            const avgSessionDuration = 120 + (Math.random() * 180); // 2-5 minutes
            
            dailyTraffic.push({
              date: date.toISOString().split('T')[0],
              pageviews,
              uniqueVisitors,
              sessions: Math.floor(uniqueVisitors * (1.1 + Math.random() * 0.3)),
              bounceRate: Math.round(bounceRate * 100) / 100,
              avgSessionDuration: Math.round(avgSessionDuration),
              newVisitors: Math.floor(uniqueVisitors * (0.2 + Math.random() * 0.3)),
            });
          }
          
          // Calculate totals and averages
          const totals = {
            pageviews: dailyTraffic.reduce((sum, day) => sum + day.pageviews, 0),
            uniqueVisitors: dailyTraffic.reduce((sum, day) => sum + day.uniqueVisitors, 0),
            sessions: dailyTraffic.reduce((sum, day) => sum + day.sessions, 0),
            avgBounceRate: dailyTraffic.reduce((sum, day) => sum + day.bounceRate, 0) / dailyTraffic.length,
            avgSessionDuration: dailyTraffic.reduce((sum, day) => sum + day.avgSessionDuration, 0) / dailyTraffic.length,
            newVisitors: dailyTraffic.reduce((sum, day) => sum + day.newVisitors, 0),
          };
          
          // Traffic sources simulation
          const trafficSources = [
            { source: 'Organic Search', visitors: Math.floor(totals.uniqueVisitors * 0.45), percentage: 45 },
            { source: 'Direct', visitors: Math.floor(totals.uniqueVisitors * 0.25), percentage: 25 },
            { source: 'Social Media', visitors: Math.floor(totals.uniqueVisitors * 0.15), percentage: 15 },
            { source: 'Referral', visitors: Math.floor(totals.uniqueVisitors * 0.10), percentage: 10 },
            { source: 'Email', visitors: Math.floor(totals.uniqueVisitors * 0.05), percentage: 5 },
          ];
          
          // Top referrers simulation
          const topReferrers = includeReferrers ? [
            { domain: 'google.com', visitors: Math.floor(totals.uniqueVisitors * 0.35), type: 'search' },
            { domain: 'facebook.com', visitors: Math.floor(totals.uniqueVisitors * 0.08), type: 'social' },
            { domain: 'twitter.com', visitors: Math.floor(totals.uniqueVisitors * 0.04), type: 'social' },
            { domain: 'linkedin.com', visitors: Math.floor(totals.uniqueVisitors * 0.03), type: 'social' },
            { domain: 'reddit.com', visitors: Math.floor(totals.uniqueVisitors * 0.02), type: 'social' },
          ] : [];
          
          // Device and browser analytics
          const deviceAnalytics = {
            desktop: { visitors: Math.floor(totals.uniqueVisitors * 0.55), percentage: 55 },
            mobile: { visitors: Math.floor(totals.uniqueVisitors * 0.35), percentage: 35 },
            tablet: { visitors: Math.floor(totals.uniqueVisitors * 0.10), percentage: 10 },
          };
          
          const browserAnalytics = [
            { browser: 'Chrome', visitors: Math.floor(totals.uniqueVisitors * 0.65), percentage: 65 },
            { browser: 'Safari', visitors: Math.floor(totals.uniqueVisitors * 0.18), percentage: 18 },
            { browser: 'Firefox', visitors: Math.floor(totals.uniqueVisitors * 0.10), percentage: 10 },
            { browser: 'Edge', visitors: Math.floor(totals.uniqueVisitors * 0.05), percentage: 5 },
            { browser: 'Other', visitors: Math.floor(totals.uniqueVisitors * 0.02), percentage: 2 },
          ];
          
          // Geographic data simulation
          const geographicData = [
            { country: 'United States', visitors: Math.floor(totals.uniqueVisitors * 0.40), percentage: 40 },
            { country: 'United Kingdom', visitors: Math.floor(totals.uniqueVisitors * 0.15), percentage: 15 },
            { country: 'Canada', visitors: Math.floor(totals.uniqueVisitors * 0.10), percentage: 10 },
            { country: 'Germany', visitors: Math.floor(totals.uniqueVisitors * 0.08), percentage: 8 },
            { country: 'France', visitors: Math.floor(totals.uniqueVisitors * 0.06), percentage: 6 },
            { country: 'Other', visitors: Math.floor(totals.uniqueVisitors * 0.21), percentage: 21 },
          ];
          
          // Identify trends
          const recentDays = dailyTraffic.slice(-7);
          const previousWeek = dailyTraffic.slice(-14, -7);
          
          const recentAvg = recentDays.reduce((sum, day) => sum + day.pageviews, 0) / recentDays.length;
          const previousAvg = previousWeek.reduce((sum, day) => sum + day.pageviews, 0) / previousWeek.length;
          const trendPercentage = ((recentAvg - previousAvg) / previousAvg) * 100;
          
          const result = {
            url,
            timeframe,
            period: {
              start: dailyTraffic[0]?.date,
              end: dailyTraffic[dailyTraffic.length - 1]?.date,
              days: dailyTraffic.length,
            },
            overview: {
              totalPageviews: totals.pageviews,
              uniqueVisitors: totals.uniqueVisitors,
              totalSessions: totals.sessions,
              averageBounceRate: Math.round(totals.avgBounceRate * 100) / 100,
              averageSessionDuration: Math.round(totals.avgSessionDuration),
              newVisitorRate: Math.round((totals.newVisitors / totals.uniqueVisitors) * 100),
            },
            dailyTraffic,
            trafficSources,
            topReferrers,
            analytics: {
              devices: deviceAnalytics,
              browsers: browserAnalytics,
              geography: geographicData,
            },
            trends: {
              weekOverWeek: {
                change: Math.round(trendPercentage * 100) / 100,
                direction: trendPercentage > 0 ? 'increasing' : 'decreasing',
                significance: Math.abs(trendPercentage) > 10 ? 'significant' : 'moderate',
              },
              peakDay: dailyTraffic.length > 0 ? dailyTraffic.reduce((peak, current) => current.pageviews > peak.pageviews ? current : peak, dailyTraffic[0]) : null,
              lowestDay: dailyTraffic.length > 0 ? dailyTraffic.reduce((low, current) => current.pageviews < low.pageviews ? current : low, dailyTraffic[0]) : null,
            },
            insights: [
              trendPercentage > 10 ? `Traffic increased by ${trendPercentage.toFixed(1)}% compared to previous week` : null,
              trendPercentage < -10 ? `Traffic decreased by ${Math.abs(trendPercentage).toFixed(1)}% compared to previous week` : null,
              totals.avgBounceRate > 0.6 ? 'High bounce rate detected - consider improving page content' : null,
              deviceAnalytics.mobile.percentage > 50 ? 'Mobile traffic dominates - ensure mobile optimization' : null,
              trafficSources.length > 0 && trafficSources[0].source === 'Organic Search' ? 'Strong SEO performance with high organic traffic' : null,
            ].filter(Boolean),
            analyzedAt: new Date().toISOString(),
            note: 'This is simulated traffic analytics data. Real implementation would integrate with analytics platforms like Google Analytics.',
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

        case 'benchmark_performance': {
          const {
            url,
            compareWith = [],
          } = args as {
            url: string;
            compareWith?: string[];
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          // Simulate performance metrics
          const performanceMetrics = {
            loadTime: {
              firstContentfulPaint: 800 + Math.random() * 1200, // 0.8-2.0s
              largestContentfulPaint: 1200 + Math.random() * 1800, // 1.2-3.0s
              firstInputDelay: 50 + Math.random() * 200, // 50-250ms
              cumulativeLayoutShift: Math.random() * 0.3, // 0-0.3
              totalBlockingTime: 100 + Math.random() * 400, // 100-500ms
              speedIndex: 1000 + Math.random() * 2000, // 1-3s
            },
            resourceMetrics: {
              totalRequests: 25 + Math.floor(Math.random() * 50),
              totalSize: 1.5 + Math.random() * 3, // MB
              htmlSize: 50 + Math.random() * 100, // KB
              cssSize: 100 + Math.random() * 200, // KB
              jsSize: 300 + Math.random() * 700, // KB
              imageSize: 800 + Math.random() * 1200, // KB
              fontSize: 50 + Math.random() * 150, // KB
            },
            networkMetrics: {
              dnsLookup: 20 + Math.random() * 80,
              tcpConnection: 30 + Math.random() * 120,
              sslHandshake: 40 + Math.random() * 160,
              serverResponse: 200 + Math.random() * 800,
              contentDownload: 100 + Math.random() * 400,
            },
          };
          
          // Calculate performance scores
          const scores = {
            performance: Math.max(0, 100 - (performanceMetrics.loadTime.largestContentfulPaint / 30)), // Rough calculation
            accessibility: 85 + Math.random() * 15, // 85-100
            bestPractices: 80 + Math.random() * 20, // 80-100
            seo: 75 + Math.random() * 25, // 75-100
          };
          
          // Performance grades
          const getGrade = (score: number) => {
            if (score >= 90) return 'A';
            if (score >= 80) return 'B';
            if (score >= 70) return 'C';
            if (score >= 60) return 'D';
            return 'F';
          };
          
          // Industry benchmarks (simulated)
          const industryBenchmarks = {
            loadTime: {
              excellent: 1500,
              good: 2500,
              needsImprovement: 4000,
            },
            firstContentfulPaint: {
              excellent: 1000,
              good: 1800,
              needsImprovement: 3000,
            },
            cumulativeLayoutShift: {
              excellent: 0.1,
              good: 0.25,
              needsImprovement: 0.4,
            },
          };
          
          // Performance recommendations
          const recommendations: Array<{ category: string; priority: 'high' | 'medium' | 'low'; description: string; impact: string }> = [];
          
          if (performanceMetrics.loadTime.largestContentfulPaint > industryBenchmarks.loadTime.needsImprovement) {
            recommendations.push({
              category: 'loading',
              priority: 'high',
              description: 'Optimize Largest Contentful Paint (LCP)',
              impact: 'Improve user experience and SEO rankings',
            });
          }
          
          if (performanceMetrics.loadTime.cumulativeLayoutShift > industryBenchmarks.cumulativeLayoutShift.good) {
            recommendations.push({
              category: 'stability',
              priority: 'medium',
              description: 'Reduce Cumulative Layout Shift (CLS)',
              impact: 'Prevent unexpected layout shifts during page load',
            });
          }
          
          if (performanceMetrics.resourceMetrics.totalSize > 3) {
            recommendations.push({
              category: 'optimization',
              priority: 'medium',
              description: 'Optimize resource sizes and implement compression',
              impact: 'Reduce bandwidth usage and improve load times',
            });
          }
          
          if (performanceMetrics.resourceMetrics.totalRequests > 50) {
            recommendations.push({
              category: 'optimization',
              priority: 'low',
              description: 'Reduce number of HTTP requests',
              impact: 'Minimize network overhead and improve performance',
            });
          }
          
          // Comparison with other URLs (if provided)
          const comparisons = compareWith.map(compareUrl => {
            // Simulate comparison data
            const comparisonMetrics = {
              url: compareUrl,
              loadTime: 1000 + Math.random() * 2000,
              performanceScore: 60 + Math.random() * 40,
              resourceSize: 1 + Math.random() * 4,
            };
            
            return {
              ...comparisonMetrics,
              comparison: {
                loadTimeDiff: performanceMetrics.loadTime.largestContentfulPaint - comparisonMetrics.loadTime,
                scoreDiff: scores.performance - comparisonMetrics.performanceScore,
                sizeDiff: performanceMetrics.resourceMetrics.totalSize - comparisonMetrics.resourceSize,
              },
            };
          });
          
          const result = {
            url: fetchResult.url,
            timestamp: new Date().toISOString(),
            metrics: performanceMetrics,
            scores: {
              performance: Math.round(scores.performance),
              accessibility: Math.round(scores.accessibility),
              bestPractices: Math.round(scores.bestPractices),
              seo: Math.round(scores.seo),
              overall: Math.round((scores.performance + scores.accessibility + scores.bestPractices + scores.seo) / 4),
            },
            grades: {
              performance: getGrade(scores.performance),
              accessibility: getGrade(scores.accessibility),
              bestPractices: getGrade(scores.bestPractices),
              seo: getGrade(scores.seo),
              overall: getGrade((scores.performance + scores.accessibility + scores.bestPractices + scores.seo) / 4),
            },
            benchmarks: {
              industry: industryBenchmarks,
              status: {
                loadTime: performanceMetrics.loadTime.largestContentfulPaint <= industryBenchmarks.loadTime.excellent ? 'excellent' :
                         performanceMetrics.loadTime.largestContentfulPaint <= industryBenchmarks.loadTime.good ? 'good' : 'needs improvement',
                fcp: performanceMetrics.loadTime.firstContentfulPaint <= industryBenchmarks.firstContentfulPaint.excellent ? 'excellent' :
                     performanceMetrics.loadTime.firstContentfulPaint <= industryBenchmarks.firstContentfulPaint.good ? 'good' : 'needs improvement',
                cls: performanceMetrics.loadTime.cumulativeLayoutShift <= industryBenchmarks.cumulativeLayoutShift.excellent ? 'excellent' :
                     performanceMetrics.loadTime.cumulativeLayoutShift <= industryBenchmarks.cumulativeLayoutShift.good ? 'good' : 'needs improvement',
              },
            },
            recommendations,
            comparisons,
            summary: {
              strengths: [
                scores.performance > 80 ? 'Good performance score' : null,
                scores.accessibility > 90 ? 'Excellent accessibility' : null,
                scores.seo > 85 ? 'Strong SEO optimization' : null,
                performanceMetrics.resourceMetrics.totalSize < 2 ? 'Optimized resource sizes' : null,
              ].filter(Boolean),
              weaknesses: [
                scores.performance < 60 ? 'Poor performance score' : null,
                performanceMetrics.loadTime.cumulativeLayoutShift > 0.25 ? 'High layout shift' : null,
                performanceMetrics.resourceMetrics.totalRequests > 50 ? 'Too many HTTP requests' : null,
                performanceMetrics.loadTime.largestContentfulPaint > 3000 ? 'Slow content loading' : null,
              ].filter(Boolean),
            },
            note: 'This is simulated performance benchmark data. Real implementation would use tools like Lighthouse, WebPageTest, or similar performance testing APIs.',
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

        case 'generate_reports': {
          const {
            url,
            reportType = 'comprehensive',
            format = 'json',
          } = args as {
            url: string;
            reportType?: 'seo' | 'performance' | 'security' | 'accessibility' | 'comprehensive';
            format?: 'json' | 'html' | 'markdown';
          };

          if (!url || typeof url !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL parameter is required and must be a string'
            );
          }

          const fetchResult = await fetchUrl(url, {
            forceRefresh: !useCache,
          });

          const $ = cheerio.load(fetchResult.content);
          const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Generate comprehensive analysis data
          const analysisData = {
            seo: {
              title: $('title').text() || 'No title found',
              metaDescription: $('meta[name="description"]').attr('content') || 'No meta description',
              headings: {
                h1: $('h1').length,
                h2: $('h2').length,
                h3: $('h3').length,
                h4: $('h4').length,
                h5: $('h5').length,
                h6: $('h6').length,
              },
              images: {
                total: $('img').length,
                withAlt: $('img[alt]').length,
                withoutAlt: $('img:not([alt])').length,
              },
              links: {
                internal: $('a[href^="/"], a[href*="' + new URL(fetchResult.url).hostname + '"]').length,
                external: $('a[href^="http"]:not([href*="' + new URL(fetchResult.url).hostname + '"])').length,
                nofollow: $('a[rel*="nofollow"]').length,
              },
              score: 75 + Math.random() * 20, // 75-95
            },
            performance: {
              loadTime: 1200 + Math.random() * 1800,
              pageSize: 1.5 + Math.random() * 2.5,
              requests: 20 + Math.floor(Math.random() * 40),
              coreWebVitals: {
                lcp: 1500 + Math.random() * 1500,
                fid: 50 + Math.random() * 150,
                cls: Math.random() * 0.3,
              },
              score: 70 + Math.random() * 25, // 70-95
            },
            security: {
              https: fetchResult.url.startsWith('https://'),
              mixedContent: $('script[src^="http://"], link[href^="http://"], img[src^="http://"]').length,
              securityHeaders: {
                csp: Math.random() > 0.5,
                hsts: Math.random() > 0.3,
                xframe: Math.random() > 0.4,
              },
              vulnerabilities: Math.floor(Math.random() * 5),
              score: 80 + Math.random() * 15, // 80-95
            },
            accessibility: {
              images: {
                withAlt: $('img[alt]').length,
                total: $('img').length,
              },
              forms: {
                withLabels: $('input[id]').filter((_, input) => $(`label[for="${$(input).attr('id')}"]`).length > 0).length,
                total: $('input, select, textarea').length,
              },
              headingStructure: $('h1, h2, h3, h4, h5, h6').length > 0,
              colorContrast: Math.random() > 0.2, // 80% pass rate
              score: 85 + Math.random() * 10, // 85-95
            },
          };
          
          // Generate report content based on type
          let reportContent: any = {};
          
          switch (reportType) {
            case 'seo':
              reportContent = {
                type: 'SEO Analysis Report',
                data: analysisData.seo,
                recommendations: [
                  analysisData.seo.metaDescription === 'No meta description' ? 'Add meta description' : null,
                  analysisData.seo.headings.h1 === 0 ? 'Add H1 heading' : null,
                  analysisData.seo.images.withoutAlt > 0 ? `Add alt text to ${analysisData.seo.images.withoutAlt} images` : null,
                  'Optimize page title for target keywords',
                  'Improve internal linking structure',
                ].filter(Boolean),
              };
              break;
              
            case 'performance':
              reportContent = {
                type: 'Performance Analysis Report',
                data: analysisData.performance,
                recommendations: [
                  analysisData.performance.loadTime > 2000 ? 'Optimize page load time' : null,
                  analysisData.performance.pageSize > 3 ? 'Reduce page size' : null,
                  analysisData.performance.requests > 50 ? 'Minimize HTTP requests' : null,
                  'Implement image optimization',
                  'Enable browser caching',
                ].filter(Boolean),
              };
              break;
              
            case 'security':
              reportContent = {
                type: 'Security Analysis Report',
                data: analysisData.security,
                recommendations: [
                  !analysisData.security.https ? 'Implement HTTPS' : null,
                  analysisData.security.mixedContent > 0 ? 'Fix mixed content issues' : null,
                  !analysisData.security.securityHeaders.csp ? 'Implement Content Security Policy' : null,
                  !analysisData.security.securityHeaders.hsts ? 'Add HSTS header' : null,
                  'Regular security audits',
                ].filter(Boolean),
              };
              break;
              
            case 'accessibility':
              reportContent = {
                type: 'Accessibility Analysis Report',
                data: analysisData.accessibility,
                recommendations: [
                  analysisData.accessibility.images.withAlt < analysisData.accessibility.images.total ? 'Add alt text to all images' : null,
                  analysisData.accessibility.forms.withLabels < analysisData.accessibility.forms.total ? 'Add labels to all form elements' : null,
                  !analysisData.accessibility.headingStructure ? 'Implement proper heading structure' : null,
                  'Test with screen readers',
                  'Ensure keyboard navigation',
                ].filter(Boolean),
              };
              break;
              
            default: // comprehensive
              reportContent = {
                type: 'Comprehensive Website Analysis Report',
                data: analysisData,
                overallScore: Math.round((analysisData.seo.score + analysisData.performance.score + analysisData.security.score + analysisData.accessibility.score) / 4),
                summary: {
                  strengths: [
                    analysisData.seo.score > 85 ? 'Strong SEO optimization' : null,
                    analysisData.performance.score > 80 ? 'Good performance metrics' : null,
                    analysisData.security.score > 85 ? 'Solid security implementation' : null,
                    analysisData.accessibility.score > 90 ? 'Excellent accessibility' : null,
                  ].filter(Boolean),
                  improvements: [
                    analysisData.seo.score < 70 ? 'SEO optimization needed' : null,
                    analysisData.performance.score < 70 ? 'Performance improvements required' : null,
                    analysisData.security.score < 75 ? 'Security enhancements needed' : null,
                    analysisData.accessibility.score < 80 ? 'Accessibility improvements required' : null,
                  ].filter(Boolean),
                },
                recommendations: [
                  'Implement regular monitoring and testing',
                  'Focus on Core Web Vitals optimization',
                  'Enhance security headers and policies',
                  'Improve accessibility compliance',
                  'Optimize for mobile devices',
                ],
              };
          }
          
          // Format report based on requested format
          let formattedReport: string;
          
          switch (format) {
            case 'html':
              formattedReport = `
<!DOCTYPE html>
<html>
<head>
    <title>${reportContent.type}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; }
        .score { font-size: 24px; font-weight: bold; color: #2196F3; }
        .recommendations { background: #fff3cd; padding: 15px; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${reportContent.type}</h1>
        <p><strong>URL:</strong> ${fetchResult.url}</p>
        <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
        ${reportContent.overallScore ? `<p class="score">Overall Score: ${reportContent.overallScore}/100</p>` : ''}
    </div>
    
    <div class="section">
        <h2>Analysis Data</h2>
        <pre>${JSON.stringify(reportContent.data, null, 2)}</pre>
    </div>
    
    <div class="section recommendations">
        <h2>Recommendations</h2>
        <ul>
            ${reportContent.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
</body>
</html>`;
              break;
              
            case 'markdown':
              formattedReport = `# ${reportContent.type}

**URL:** ${fetchResult.url}  
**Generated:** ${new Date().toISOString()}  
${reportContent.overallScore ? `**Overall Score:** ${reportContent.overallScore}/100\n\n` : ''}

## Analysis Data

\`\`\`json
${JSON.stringify(reportContent.data, null, 2)}
\`\`\`

## Recommendations

${reportContent.recommendations.map((rec: string) => `- ${rec}`).join('\n')}

---
*Report generated by MCP Web Scrape Server*`;
              break;
              
            default: // json
              formattedReport = JSON.stringify({
                reportId,
                url: fetchResult.url,
                generatedAt: new Date().toISOString(),
                ...reportContent,
              }, null, 2);
          }
          
          const result = {
            reportId,
            url: fetchResult.url,
            reportType,
            format,
            generatedAt: new Date().toISOString(),
            report: formattedReport,
            metadata: {
              analysisPoints: Object.keys(reportContent.data).length,
              recommendationCount: reportContent.recommendations?.length || 0,
              overallScore: reportContent.overallScore || null,
              reportSize: formattedReport.length,
            },
            downloadInfo: {
              filename: `${reportType}_report_${new Date().toISOString().split('T')[0]}.${format}`,
              mimeType: format === 'html' ? 'text/html' : format === 'markdown' ? 'text/markdown' : 'application/json',
            },
            note: 'This is a simulated comprehensive report. Real implementation would perform actual analysis using specialized tools and APIs.',
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

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${name}`
          );
      }
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      // Handle other errors
      const message = error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Tool execution failed: ${message}`
      );
    }
  });

  return server;
}