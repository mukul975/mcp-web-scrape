/**
  * Caching system for MCP Web Scrape Server
  * Handles HTTP caching with ETags and Last-Modified headers
  */
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
declare class ContentCache {
    private cache;
    private accessOrder;
    private accessCounter;
    /**
      * Get a cache entry by URL
      */
    get(url: string): CacheEntry | undefined;
    /**
      * Set a cache entry
      */
    set(entry: CacheEntry): void;
    /**
      * Delete a cache entry
      */
    delete(url: string): boolean;
    /**
      * Check if an entry is still valid based on TTL
      */
    private isEntryValid;
    /**
      * Enforce maximum cache size using LRU eviction
      */
    private enforceMaxSize;
    /**
     * Get all cache entries
     */
    getAll(): CacheEntry[];
    /**
     * Get cache statistics
     */
    getStats(): CacheStats;
    /**
     * Clear all cache entries
     */
    clear(): void;
    /**
     * Clean up expired entries
     */
    cleanup(): number;
    /**
     * Get conditional request headers for a URL
     */
    getConditionalHeaders(url: string): Record<string, string>;
    /**
     * Check if we have a cached version of a URL
     */
    has(url: string): boolean;
    /**
     * Get cache entry metadata (without content)
     */
    getMetadata(url: string): Omit<CacheEntry, 'content'> | undefined;
}
export declare const cache: ContentCache;
export {};
//# sourceMappingURL=cache.d.ts.map