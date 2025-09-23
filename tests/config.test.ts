/**
 * Tests for configuration management
 */

import { loadConfig } from '../src/config.js';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  it('should load default configuration', () => {
    const config = loadConfig();
    
    expect(config.httpPort).toBe(3000);
    expect(config.httpHost).toBe('127.0.0.1');
    expect(config.timeout).toBe(10000);
    expect(config.maxSize).toBe(5 * 1024 * 1024);
    expect(config.respectRobots).toBe(true);
    expect(config.maxRequestsPerMinute).toBe(30);
  });

  it('should parse environment variables correctly', () => {
    process.env['MCP_WS_PORT'] = '8080';
    process.env['MCP_WS_HOST'] = '0.0.0.0';
    process.env['MCP_WS_TIMEOUT'] = '15000';
    process.env['MCP_WS_RESPECT_ROBOTS'] = 'false';
    
    const config = loadConfig();
    
    expect(config.httpPort).toBe(8080);
    expect(config.httpHost).toBe('0.0.0.0');
    expect(config.timeout).toBe(15000);
    expect(config.respectRobots).toBe(false);
  });

  it('should handle invalid environment variables gracefully', () => {
    process.env['MCP_WS_PORT'] = 'invalid';
    process.env['MCP_WS_TIMEOUT'] = 'not-a-number';
    
    const config = loadConfig();
    
    // Should fall back to defaults
    expect(config.httpPort).toBe(3000);
    expect(config.timeout).toBe(10000);
  });

  it('should parse arrays correctly', () => {
    process.env['MCP_WS_ALLOWED_HOSTS'] = 'example.com,test.com,  another.com  ';
    process.env['MCP_WS_BLOCKED_HOSTS'] = 'bad.com, evil.com';
    
    const config = loadConfig();
    
    expect(config.allowedHosts).toEqual(['example.com', 'test.com', 'another.com']);
    expect(config.blockedHosts).toEqual(['bad.com', 'evil.com']);
  });

  it('should handle boolean values correctly', () => {
    process.env['MCP_WS_RESPECT_ROBOTS'] = 'true';
    let config = loadConfig();
    expect(config.respectRobots).toBe(true);

    process.env['MCP_WS_RESPECT_ROBOTS'] = '1';
    config = loadConfig();
    expect(config.respectRobots).toBe(true);

    process.env['MCP_WS_RESPECT_ROBOTS'] = 'false';
    config = loadConfig();
    expect(config.respectRobots).toBe(false);

    process.env['MCP_WS_RESPECT_ROBOTS'] = '0';
    config = loadConfig();
    expect(config.respectRobots).toBe(false);
  });
});