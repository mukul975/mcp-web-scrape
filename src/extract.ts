import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { config } from './config.js';

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

// Initialize Turndown service for HTML to Markdown conversion
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
  strongDelimiter: '**'
});

// Configure Turndown rules
turndownService.addRule('removeScripts', {
  filter: ['script', 'style', 'noscript'],
  replacement: () => ''
});

turndownService.addRule('preserveCodeBlocks', {
  filter: 'pre',
  replacement: (content, node) => {
    const codeElement = node.querySelector('code');
    if (codeElement) {
      const language = codeElement.className.match(/language-(\w+)/)?.[1] || '';
      return `\n\`\`\`${language}\n${codeElement.textContent || ''}\n\`\`\`\n`;
    }
    return `\n\`\`\`\n${content}\n\`\`\`\n`;
  }
});

/**
 * Extract the main title from HTML
 */
function extractTitle($: cheerio.CheerioAPI): string {
  // Try multiple selectors in order of preference
  const titleSelectors = [
    'h1',
    'title',
    '[property="og:title"]',
    '[name="twitter:title"]',
    '.title',
    '.headline',
    'header h1',
    'article h1'
  ];

  for (const selector of titleSelectors) {
    const element = $(selector).first();
    if (element.length) {
      const title = element.attr('content') || element.text();
      if (title && title.trim().length > 0) {
        return title.trim();
      }
    }
  }

  return 'Untitled';
}

/**
 * Extract author information from HTML
 */
function extractAuthor($: cheerio.CheerioAPI): string | undefined {
  const authorSelectors = [
    '[rel="author"]',
    '[property="article:author"]',
    '[name="author"]',
    '[name="twitter:creator"]',
    '.author',
    '.byline',
    '.writer',
    '[itemprop="author"]'
  ];

  for (const selector of authorSelectors) {
    const element = $(selector).first();
    if (element.length) {
      const author = element.attr('content') || element.text();
      if (author && author.trim().length > 0) {
        return author.trim();
      }
    }
  }

  return undefined;
}

/**
 * Extract main content from HTML
 */
function extractMainContent($: cheerio.CheerioAPI): cheerio.Cheerio<any> {
  // Try to find main content area
  const contentSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.content',
    '.post-content',
    '.entry-content',
    '.article-content',
    '.story-body',
    '#content',
    '#main-content'
  ];

  for (const selector of contentSelectors) {
    const element = $(selector).first();
    if (element.length && element.text().trim().length > 100) {
      return element;
    }
  }

  // Fallback: try to find the largest text block
  let bestElement = $('body');
  let maxTextLength = 0;

  $('div, section, article').each((_, element) => {
    const $element = $(element);
    const textLength = $element.text().trim().length;
    if (textLength > maxTextLength && textLength > 100) {
      maxTextLength = textLength;
      bestElement = $element;
    }
  });

  return bestElement;
}

/**
 * Clean up content by removing unwanted elements
 */
function cleanContent($: cheerio.CheerioAPI, content: cheerio.Cheerio<any>): void {
  // Remove unwanted elements
  const unwantedSelectors = [
    'script',
    'style',
    'noscript',
    'iframe',
    'embed',
    'object',
    '.advertisement',
    '.ads',
    '.social-share',
    '.comments',
    '.sidebar',
    '.footer',
    '.header',
    '.navigation',
    '.nav',
    '.menu',
    '[class*="ad-"]',
    '[id*="ad-"]',
    '[class*="social"]',
    '[class*="share"]'
  ];

  unwantedSelectors.forEach(selector => {
    content.find(selector).remove();
  });

  // Remove empty paragraphs and divs
  content.find('p, div').each((_, element) => {
    const $element = $(element);
    if ($element.text().trim().length === 0 && $element.children().length === 0) {
      $element.remove();
    }
  });
}

/**
 * Generate citation for the content
 */
function generateCitation(title: string, url: string, author?: string): string {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  let citation = `**${title}**`;
  
  if (author) {
    citation += ` by ${author}`;
  }
  
  citation += `\n*Source: [${url}](${url})*\n*Fetched: ${timestamp}*\n`;
  
  return citation;
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Extract and clean content from HTML
 */
export function extractContent(
  html: string,
  url: string,
  options: ExtractionOptions = {}
): ExtractedContent {
  const {
    format = 'markdown',
    includeImages = true,
    includeLinks = true,
    maxLength = config.maxSize
  } = options;

  // Parse HTML
  const $ = cheerio.load(html);

  // Extract metadata
  const title = extractTitle($);
  const author = extractAuthor($);

  // Extract main content
  const mainContent = extractMainContent($);
  
  // Clean content
  cleanContent($, mainContent);

  // Handle images and links based on options
  if (!includeImages) {
    mainContent.find('img').remove();
  }
  
  if (!includeLinks) {
    mainContent.find('a').each((_, element) => {
      const $element = $(element);
      $element.replaceWith($element.text());
    });
  }

  // Convert to desired format
  let content: string;
  
  switch (format) {
    case 'text':
      content = mainContent.text().trim();
      break;
    case 'json':
      content = JSON.stringify({
        title,
        author,
        content: mainContent.text().trim(),
        html: mainContent.html()
      }, null, 2);
      break;
    case 'markdown':
    default:
      content = turndownService.turndown(mainContent.html() || '');
      break;
  }

  // Truncate if too long
  if (maxLength && content.length > maxLength) {
    content = content.substring(0, maxLength) + '\n\n*[Content truncated]*';
  }

  // Generate citation
  const citation = generateCitation(title, url, author);

  return {
    title,
    author,
    content,
    url,
    timestamp: Date.now(),
    wordCount: countWords(content),
    citation
  };
}

/**
 * Simple summarization function
 */
export function summarizeContent(
  content: string,
  maxLength: number = 500,
  format: 'paragraph' | 'bullets' = 'paragraph'
): string {
  // Simple extractive summarization
  const sentences = content
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20); // Filter out very short sentences

  if (sentences.length === 0) {
    return 'No content to summarize.';
  }

  // Score sentences by length and position (earlier sentences get higher scores)
  const scoredSentences = sentences.map((sentence, index) => ({
    sentence,
    score: sentence.length * (1 - index / sentences.length * 0.5)
  }));

  // Sort by score and take top sentences
  scoredSentences.sort((a, b) => b.score - a.score);
  
  let summary = '';
  let currentLength = 0;
  const selectedSentences: string[] = [];

  for (const { sentence } of scoredSentences) {
    if (currentLength + sentence.length > maxLength) {
      break;
    }
    selectedSentences.push(sentence);
    currentLength += sentence.length;
  }

  if (format === 'bullets') {
    summary = selectedSentences.map(s => `• ${s.trim()}`).join('\n');
  } else {
    summary = selectedSentences.join('. ').trim();
    if (!summary.endsWith('.')) {
      summary += '.';
    }
  }

  return summary || 'Unable to generate summary.';
}