export interface ExtractedContent {
    title: string;
    author?: string | undefined;
    content: string;
    url: string;
    timestamp: number;
    wordCount: number;
    citation: string;
}
export interface ExtractionOptions {
    format?: 'markdown' | 'text' | 'json';
    includeImages?: boolean;
    includeLinks?: boolean;
    maxLength?: number;
}
/**
 * Extract and clean content from HTML
 */
export declare function extractContent(html: string, url: string, options?: ExtractionOptions): ExtractedContent;
/**
 * Simple summarization function
 */
export declare function summarizeContent(content: string, maxLength?: number, format?: 'paragraph' | 'bullets'): string;
//# sourceMappingURL=extract.d.ts.map