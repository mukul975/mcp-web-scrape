/**
 * Generic MCP Client Example
 * Shows how to connect to mcp-web-scrape server programmatically
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

// Example 1: Connect via HTTP/SSE
async function connectViaHTTP() {
  console.log('Connecting to MCP Web Scrape Server via HTTP/SSE...');
  
  const transport = new SSEClientTransport('http://localhost:3000/sse');
  const client = new Client({
    name: 'example-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    console.log('Connected successfully!');
    
    // List available tools
    const tools = await client.listTools();
    console.log('Available tools:', tools.tools.map(t => t.name));
    
    // Extract content from a webpage
    const result = await client.callTool({
      name: 'extract_content',
      arguments: {
        url: 'https://example.com',
        format: 'markdown',
        includeImages: true,
        includeLinks: true
      }
    });
    
    console.log('Extracted content:', result.content[0].text);
    
    // List cached resources
    const resources = await client.listResources();
    console.log('Cached resources:', resources.resources.length);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Example 2: Connect via STDIO
async function connectViaSTDIO() {
  console.log('Connecting to MCP Web Scrape Server via STDIO...');
  
  // Spawn the server process
  const serverProcess = spawn('node', ['../dist/stdio.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      MCP_RESPECT_ROBOTS: 'true',
      MCP_MAX_SIZE: '5242880'
    }
  });
  
  const transport = new StdioClientTransport({
    stdin: serverProcess.stdin,
    stdout: serverProcess.stdout
  });
  
  const client = new Client({
    name: 'stdio-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    console.log('Connected via STDIO!');
    
    // Extract and summarize content
    const extractResult = await client.callTool({
      name: 'extract_content',
      arguments: {
        url: 'https://en.wikipedia.org/wiki/Model_Context_Protocol',
        format: 'text'
      }
    });
    
    const content = extractResult.content[0].text;
    console.log('Extracted content length:', content.length);
    
    // Generate summary
    const summaryResult = await client.callTool({
      name: 'summarize_content',
      arguments: {
        content: content,
        maxLength: 200,
        format: 'bullets'
      }
    });
    
    console.log('Summary:', summaryResult.content[0].text);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    serverProcess.kill();
  }
}

// Example 3: Batch processing multiple URLs
async function batchProcess() {
  console.log('Batch processing multiple URLs...');
  
  const transport = new SSEClientTransport('http://localhost:3000/sse');
  const client = new Client({
    name: 'batch-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  const urls = [
    'https://example.com',
    'https://httpbin.org/html',
    'https://en.wikipedia.org/wiki/Web_scraping'
  ];

  try {
    await client.connect(transport);
    
    const results = [];
    
    for (const url of urls) {
      try {
        console.log(`Processing: ${url}`);
        
        const result = await client.callTool({
          name: 'extract_content',
          arguments: {
            url: url,
            format: 'json',
            useCache: true
          }
        });
        
        const data = JSON.parse(result.content[0].text);
        results.push({
          url: url,
          title: data.title,
          wordCount: data.wordCount,
          fromCache: data.fromCache
        });
        
        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Failed to process ${url}:`, error.message);
        results.push({
          url: url,
          error: error.message
        });
      }
    }
    
    console.log('\nBatch results:');
    console.table(results);
    
  } catch (error) {
    console.error('Batch processing error:', error);
  } finally {
    await client.close();
  }
}

// Example 4: Cache management
async function manageCacheExample() {
  console.log('Cache management example...');
  
  const transport = new SSEClientTransport('http://localhost:3000/sse');
  const client = new Client({
    name: 'cache-manager',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    
    // Extract some content to populate cache
    await client.callTool({
      name: 'extract_content',
      arguments: {
        url: 'https://example.com',
        useCache: true
      }
    });
    
    // List cached resources
    const resources = await client.listResources();
    console.log(`Found ${resources.resources.length} cached resources`);
    
    for (const resource of resources.resources) {
      console.log(`- ${resource.name}: ${resource.uri}`);
      
      // Read cached content
      const content = await client.readResource({ uri: resource.uri });
      console.log(`  Content length: ${content.contents[0].text.length} characters`);
    }
    
    // Clear specific cache entry
    if (resources.resources.length > 0) {
      const firstResource = resources.resources[0];
      const url = decodeURIComponent(firstResource.uri.replace('cache://', ''));
      
      await client.callTool({
        name: 'clear_cache',
        arguments: { url: url }
      });
      
      console.log(`Cleared cache for: ${url}`);
    }
    
  } catch (error) {
    console.error('Cache management error:', error);
  } finally {
    await client.close();
  }
}

// Run examples
async function main() {
  const example = process.argv[2] || 'http';
  
  switch (example) {
    case 'http':
      await connectViaHTTP();
      break;
    case 'stdio':
      await connectViaSTDIO();
      break;
    case 'batch':
      await batchProcess();
      break;
    case 'cache':
      await manageCacheExample();
      break;
    default:
      console.log('Usage: node generic-client.js [http|stdio|batch|cache]');
      console.log('\nExamples:');
      console.log('  node generic-client.js http   # Connect via HTTP/SSE');
      console.log('  node generic-client.js stdio  # Connect via STDIO');
      console.log('  node generic-client.js batch  # Batch process URLs');
      console.log('  node generic-client.js cache  # Cache management');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}