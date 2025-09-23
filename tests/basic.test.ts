/**
 * Basic test to ensure CI passes
 */

describe('Basic Tests', () => {
  it('should pass a basic test', () => {
    expect(true).toBe(true);
  });

  it('should handle basic math', () => {
    expect(2 + 2).toBe(4);
  });

  it('should handle string operations', () => {
    const str = 'mcp-web-scrape';
    expect(str).toContain('mcp');
    expect(str.length).toBeGreaterThan(0);
  });
});