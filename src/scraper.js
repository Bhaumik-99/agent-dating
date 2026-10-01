/**
 * scraper.js
 * Grounded public-page scraper for LinkedIn and Instagram using Playwright and Cheerio.
 * 
 * Complies with strict assignment requirements:
 * - Exactly two sources: public LinkedIn and public Instagram
 * - No third-party APIs or external enrichment
 * - Explicit status tagging: 'verified_public' | 'limited' | 'failed'
 * - In-memory cache for speed and determinism
 */

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { validateSourceUrls, normalizeUrl, emptySource } from './schema.js';

const TIMEOUT = Number(process.env.SCRAPE_TIMEOUT_MS || 20000);
const SCRAPE_CACHE = new Map();

/**
 * Extract public structured content, OpenGraph meta, JSON-LD, and visible text from HTML.
 */
export function extractHtml(html, url) {
  const $ = cheerio.load(html);
  const title = $('title').first().text().replace(/\s+/g, ' ').trim();

  // Extract all public metadata tags
  const metas = [];
  $('meta[name="description"], meta[property="og:description"], meta[property="og:title"], meta[name="twitter:description"], meta[name="twitter:title"]').each((_, el) => {
    const c = $(el).attr('content');
    if (c && c.trim()) metas.push(c.trim());
  });

  // Extract structured JSON-LD data
  const jsonld = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const t = $(el).text().trim();
    if (t) jsonld.push(t.slice(0, 10000));
  });

  // Remove non-content elements
  $('script, style, noscript, nav, footer, iframe, [aria-hidden="true"]').remove();

  let body = '';
  if (url.includes('linkedin.com')) {
    const sections = [
      '.top-card-layout',
      '.profile-topcard',
      'section.summary',
      'section.experience',
      'section.education',
      '.pv-about',
      '.pv-top-card',
      '.profile-section',
      'main',
      'body'
    ];
    for (const sel of sections) {
      const text = $(sel).text().replace(/\s+/g, ' ').trim();
      if (text.length > 200) { body = text.slice(0, 25000); break; }
    }
  } else if (url.includes('instagram.com')) {
    const sections = ['header', 'main', 'article', '.profile', 'body'];
    for (const sel of sections) {
      const text = $(sel).text().replace(/\s+/g, ' ').trim();
      if (text.length > 100) { body = text.slice(0, 20000); break; }
    }
  }

  if (!body) {
    body = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 20000);
  }

  const parts = [
    `URL: ${url}`,
    title ? `TITLE: ${title}` : '',
    metas.length ? `META: ${metas.join(' | ')}` : '',
    jsonld.length ? `JSONLD: ${jsonld.join(' | ')}` : '',
    body ? `VISIBLE_TEXT: ${body}` : ''
  ].filter(Boolean);

  return parts.join('\n');
}

/**
 * Detect whether the page is blocked by a login wall or sign-in barrier.
 */
export function detectPageStatus(text, url) {
  const lower = text.toLowerCase();

  if (url.includes('linkedin.com')) {
    const isLoginWall = lower.includes('sign in') && lower.includes('join now') && text.length < 1500;
    const isRestricted = lower.includes('authwall') || lower.includes('join to view full profile');
    if (isLoginWall || isRestricted || text.length < 1200) {
      return 'limited';
    }
    return 'verified_public';
  }

  if (url.includes('instagram.com')) {
    const isLoginWall = lower.includes('log in to instagram') || lower.includes('login') && text.length < 500;
    if (isLoginWall || text.length < 350) {
      return 'limited';
    }
    return 'verified_public';
  }

  return text.length > 500 ? 'verified_public' : 'limited';
}

/**
 * Scrapes a public LinkedIn or Instagram page using Playwright.
 * Enforces strict domain limits and returns standardized source structure.
 */
export async function scrapePublicPage(rawUrl, maxRetries = 2) {
  const url = normalizeUrl(rawUrl);

  // Validate URL boundary
  if (url.includes('linkedin.com')) {
    validateSourceUrls(url, 'https://www.instagram.com/valid_check/');
  } else if (url.includes('instagram.com')) {
    validateSourceUrls('https://www.linkedin.com/in/valid-check/', url);
  } else {
    throw new Error(`Unsupported source domain: "${url}". Only public LinkedIn and Instagram URLs are allowed.`);
  }

  // Cache hit check
  if (SCRAPE_CACHE.has(url)) {
    return SCRAPE_CACHE.get(url);
  }

  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let browser = null;
    try {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        locale: 'en-US',
        viewport: { width: 1280, height: 800 },
        extraHTTPHeaders: {
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        }
      });

      const page = await context.newPage();

      // Block images/media to reduce network overhead
      await page.route('**/*.{png,jpg,jpeg,gif,webp,mp4,mp3,woff,woff2,ttf,otf}', r => r.abort());
      await page.route('**/ads/**', r => r.abort());

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
      await page.waitForTimeout(2000);

      const html = await page.content();
      const extractedText = extractHtml(html, url);
      const status = detectPageStatus(extractedText, url);

      const result = {
        url,
        status,
        text: extractedText,
        retrieved_at: new Date().toISOString()
      };

      SCRAPE_CACHE.set(url, result);
      return result;

    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1500));
      }
    } finally {
      if (browser) {
        try { await browser.close(); } catch (_) {}
      }
    }
  }

  // Graceful failure with structured response
  const failedSource = {
    url,
    status: 'failed',
    text: `URL: ${url}\nERROR: Unable to retrieve public page (${lastError?.message || 'timeout'})`,
    retrieved_at: new Date().toISOString()
  };
  SCRAPE_CACHE.set(url, failedSource);
  return failedSource;
}
