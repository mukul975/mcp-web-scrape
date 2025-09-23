/**
 * Robots.txt handling for MCP Web Scrape Server
 * Checks robots.txt compliance with bypass options
 */
export interface RobotsResult {
    allowed: boolean;
    reason?: string;
    robotsUrl?: string;
}
/**
 * Check if a URL is allowed by robots.txt
 */
export declare function checkRobots(url: string, userAgent?: string): Promise<RobotsResult>;
/**
 * Check if a URL is allowed, with option to bypass robots.txt
 */
export declare function checkUrlAllowed(url: string, bypassRobots?: boolean): Promise<RobotsResult>;
/**
 * Clear the robots cache (useful for testing or manual cache management)
 */
export declare function clearRobotsCache(): void;
/**
 * Get robots cache statistics
 */
export declare function getRobotsCacheStats(): {
    size: number;
    entries: Array<{
        url: string;
        timestamp: number;
    }>;
};
//# sourceMappingURL=robots.d.ts.map