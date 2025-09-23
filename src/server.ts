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