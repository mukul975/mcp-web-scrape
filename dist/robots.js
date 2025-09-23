/**
 * Robots.txt handling for MCP Web Scrape Server
 * Checks robots.txt compliance with bypass options
 */
import fetch from 'node-fetch';
import robotsParser from 'robots-parser';
import { config } from './config.js';
// Cache for robots.txt files to avoid repeated fetches
const robotsCache = new Map();
const ROBOTS_CACHE_TTL = 3600000; // 1 hour
/**
 * Get the robots.txt URL for a given page URL
 */
function getRobotsUrl(url) {
    const parsedUrl = new URL(url);
    return `${parsedUrl.protocol}//${parsedUrl.host}/robots.txt`;
}
/**
 * Fetch and parse robots.txt file
 */
async function fetchRobots(robotsUrl) {
    const cacheKey = robotsUrl;
    const cached = robotsCache.get(cacheKey);
    // Check if we have a valid cached version
    if (cached && (Date.now() - cached.timestamp) < ROBOTS_CACHE_TTL) {
        return cached.robots;
    }
    try {
        const response = await fetch(robotsUrl, {
            method: 'GET',
            headers: {
                'User-Agent': config.userAgent
            },
            signal: AbortSignal.timeout(config.robotsTimeout)
        });
        if (!response.ok) {
            // If robots.txt doesn't exist, assume everything is allowed
            if (response.status === 404) {
                const robots = robotsParser(robotsUrl, '');
                robotsCache.set(cacheKey, { robots, timestamp: Date.now() });
                return robots;
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const robotsText = await response.text();
        const robots = robotsParser(robotsUrl, robotsText);
        // Cache the parsed robots
        robotsCache.set(cacheKey, { robots, timestamp: Date.now() });
        return robots;
    }
    catch (error) {
        // On error, assume everything is allowed but log the issue
        console.error(`Failed to fetch robots.txt from ${robotsUrl}:`, error);
        const robots = robotsParser(robotsUrl, '');
        robotsCache.set(cacheKey, { robots, timestamp: Date.now() });
        return robots;
    }
}
/**
 * Check if a URL is allowed by robots.txt
 */
export async function checkRobots(url, userAgent = config.userAgent) {
    // If robots checking is disabled, always allow
    if (!config.respectRobots) {
        return {
            allowed: true,
            reason: 'Robots.txt checking disabled'
        };
    }
    try {
        const robotsUrl = getRobotsUrl(url);
        const robots = await fetchRobots(robotsUrl);
        const allowed = robots.isAllowed(url, userAgent);
        return {
            allowed,
            reason: allowed ? 'Allowed by robots.txt' : 'Disallowed by robots.txt',
            robotsUrl
        };
    }
    catch (error) {
        // On error, assume allowed but note the issue
        return {
            allowed: true,
            reason: `Error checking robots.txt: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
}
/**
 * Check if a URL is allowed, with option to bypass robots.txt
 */
export async function checkUrlAllowed(url, bypassRobots = false) {
    if (bypassRobots) {
        return {
            allowed: true,
            reason: 'Robots.txt check bypassed by user'
        };
    }
    return await checkRobots(url);
}
/**
 * Clear the robots cache (useful for testing or manual cache management)
 */
export function clearRobotsCache() {
    robotsCache.clear();
}
/**
 * Get robots cache statistics
 */
export function getRobotsCacheStats() {
    const entries = Array.from(robotsCache.entries()).map(([url, data]) => ({
        url,
        timestamp: data.timestamp
    }));
    return {
        size: robotsCache.size,
        entries
    };
}
//# sourceMappingURL=robots.js.map