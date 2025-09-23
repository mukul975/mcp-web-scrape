#!/usr/bin/env node
/**
 * HTTP launcher for MCP Web Scrape Server
 * Provides Server-Sent Events (SSE) transport for remote connections
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createServer } from './server.js';
import { config } from './config.js';

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: true, // Allow all origins for development
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
}));

// Parse JSON bodies
app.use(express.json({ limit: '1mb' }));

// Health check endpoint
app.get('/health', (_, res) => {
  res.json({
    status: 'healthy',
    service: 'mcp-web-scrape',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Server info endpoint
app.get('/info', (_, res) => {
  res.json({
    name: 'mcp-web-scrape',
    version: '1.0.0',
    description: 'Clean, cached web content for agents—Markdown + citations',
    capabilities: {
      tools: ['extract_content', 'summarize_content', 'clear_cache'],
      resources: ['cached content entries'],
      transports: ['sse'],
    },
    config: {
      respectRobots: config.respectRobots,
      maxSize: config.maxSize,
      timeout: config.timeout,
      maxCacheEntries: config.maxCacheEntries,
      cacheTtl: config.cacheTtl,
    },
  });
});

// MCP SSE endpoint
app.get('/sse', async (req, res) => {
  console.log('New SSE connection from:', req.ip);
  
  // Create the MCP server
  const server = createServer();
  
  // Create SSE transport
  const transport = new SSEServerTransport('/sse', res);
  
  // Connect server to transport
  await server.connect(transport);
  
  // Handle client disconnect
  req.on('close', () => {
    console.log('SSE connection closed:', req.ip);
  });
});

// Handle MCP POST requests (alternative to SSE)
app.post('/mcp', async (req, res) => {
  try {
    console.log('MCP POST request from:', req.ip);
    
    // Create the MCP server
    createServer();
    
    // Handle the request directly
    // Note: This is a simplified implementation
    // In a production environment, you might want to use a proper transport
    
    res.json({
      error: 'POST transport not implemented. Please use SSE endpoint at /sse',
    });
  } catch (error) {
    console.error('Error handling MCP POST request:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Error handling middleware
app.use((err: any, _: express.Request, res: express.Response, __: express.NextFunction) => {
  console.error('Express error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message || 'Unknown error',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Endpoint ${req.method} ${req.path} not found`,
    availableEndpoints: {
      'GET /health': 'Health check',
      'GET /info': 'Server information',
      'GET /sse': 'MCP Server-Sent Events endpoint',
      'POST /mcp': 'MCP HTTP endpoint (not implemented)',
    },
  });
});

async function main() {
  const port = config.httpPort;
  const host = config.httpHost;
  
  app.listen(port, host, () => {
    console.log(`MCP Web Scrape Server listening on http://${host}:${port}`);
    console.log(`Health check: http://${host}:${port}/health`);
    console.log(`Server info: http://${host}:${port}/info`);
    console.log(`MCP SSE endpoint: http://${host}:${port}/sse`);
    console.log('\nServer capabilities:');
    console.log('  - extract_content: Extract and clean web page content');
    console.log('  - summarize_content: Generate content summaries');
    console.log('  - clear_cache: Manage cached content');
    console.log('\nResources:');
    console.log('  - cache://[url]: Access cached content entries');
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down MCP Web Scrape Server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down MCP Web Scrape Server...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('Failed to start MCP Web Scrape Server:', error);
  process.exit(1);
});