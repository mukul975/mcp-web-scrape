/**
 * Caching system for MCP Web Scrape Server
 * Handles HTTP caching with ETags and Last-Modified headers
 */

import { config } from './config.js';

export interface CacheEntry {
  url: string;
  content: string;
  title: string;
  author?: string;
  timestamp: number;
  etag?: string;
  lastModified?: string;
  contentType?: string;
  size: number;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  oldestEntry?: number | undefined;
  newestEntry?: number | undefined;
}

class ContentCache {
  private cache = new Map<string, CacheEntry>();
  private accessOrder = new Map<string, number>(); // For LRU eviction
  private accessCounter = 0;

  /**
   * Get a cache entry by URL
   */
  get(url: string): CacheEntry | undefined {
    const entry = this.cache.get(url);
    if (entry) {
      // Update access order for LRU
      this.accessOrder.set(url, ++this.accessCounter);
      
      // Check if entry is still valid
      if (this.isEntryValid(entry)) {
        return entry;
      } else {
        // Remove expired entry
        this.delete(url);
        return undefined;
      }
    }
    return undefined;
  }

  /**
   * Set a cache entry
   */
  set(entry: CacheEntry): void {
    // Ensure we don't exceed max cache size
    this.enforceMaxSize();
    
    this.cache.set(entry.url, entry);
    this.accessOrder.set(entry.url, ++this.accessCounter);
  }

  /**
   * Delete a cache entry
   */
  delete(url: string): boolean {
    this.accessOrder.delete(url);
    return this.cache.delete(url);
  }

  /**
   * Check if an entry is still valid based on TTL
   */
  private isEntryValid(entry: CacheEntry): boolean {
    const age = Date.now() - entry.timestamp;
    return age < (config.cacheTtl * 1000);
  }

  /**
   * Enforce maximum cache size using LRU eviction
   */
  private enforceMaxSize(): void {
    while (this.cache.size >= config.maxCacheEntries) {
      // Find the least recently used entry
      let oldestUrl: string | undefined;
      let oldestAccess = Infinity;
      
      for (const [url, accessTime] of this.accessOrder) {
        if (accessTime < oldestAccess) {
          oldestAccess = accessTime;
          oldestUrl = url;
        }
      }
      
      if (oldestUrl) {
        this.delete(oldestUrl);
      } else {
        // Fallback: clear everything if we can't find LRU
        this.clear();
        break;
      }
    }
  }

  /**
   * Get all cache entries
   */
  getAll(): CacheEntry[] {
    return Array.from(this.cache.values()).filter(entry => this.isEntryValid(entry));
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = this.getAll();
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const timestamps = entries.map(entry => entry.timestamp);
    
    const result: CacheStats = {
      totalEntries: entries.length,
      totalSize
    };
    
    if (timestamps.length > 0) {
      result.oldestEntry = Math.min(...timestamps);
      result.newestEntry = Math.max(...timestamps);
    }
    
    return result;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const initialSize = this.cache.size;
    const expiredUrls: string[] = [];
    
    for (const [url, entry] of this.cache) {
      if (!this.isEntryValid(entry)) {
        expiredUrls.push(url);
      }
    }
    
    expiredUrls.forEach(url => this.delete(url));
    
    return initialSize - this.cache.size;
  }

  /**
   * Get conditional request headers for a URL
   */
  getConditionalHeaders(url: string): Record<string, string> {
    const entry = this.cache.get(url);
    const headers: Record<string, string> = {};
    
    if (entry) {
      if (entry.etag) {
        headers['If-None-Match'] = entry.etag;
      }
      if (entry.lastModified) {
        headers['If-Modified-Since'] = entry.lastModified;
      }
    }
    
    return headers;
  }

  /**
   * Check if we have a cached version of a URL
   */
  has(url: string): boolean {
    const entry = this.cache.get(url);
    return entry !== undefined && this.isEntryValid(entry);
  }

  /**
   * Get cache entry metadata (without content)
   */
  getMetadata(url: string): Omit<CacheEntry, 'content'> | undefined {
    const entry = this.get(url);
    if (entry) {
      const { content, ...metadata } = entry;
      return metadata;
    }
    return undefined;
  }
}

// Export singleton instance
export const cache = new ContentCache();

// Periodic cleanup
setInterval(() => {
  const cleaned = cache.cleanup();
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} expired cache entries`);
  }
}, 300000); // Every 5 minutes