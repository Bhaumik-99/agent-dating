import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

const TIMEOUT = Number(process.env.SCRAPE_TIMEOUT_MS || 22000);

const ALLOWED_HOSTS = [
  'linkedin.com', 'www.linkedin.com', 'in.linkedin.com',
  'instagram.com', 'www.instagram.com'
];

function normalizeUrl(url) {
  const u = new URL(url);
  u.hash = '';
  return u.toString().replace(/\/$/, '');
}

function extractHtml(html, url) {
  const $ = cheerio.load(html);
  const title = $('title').first().text().trim();

  const metas = [];
  $('meta[name="description"], meta[property="og:description"], meta[property="og:title"], meta[name="twitter:description"], meta[name="twitter:title"]').each((_, el) => {
    const c = $(el).attr('content');
    if (c && c.trim()) metas.push(c.trim());
  });

  const jsonld = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const t = $(el).text().trim();
    if (t) jsonld.push(t.slice(0, 8000));
  });

  // Remove noise
  $('script, style, noscript, nav, footer, iframe, [aria-hidden="true"]').remove();

  // Try to get meaningful content
  let body = '';

  // LinkedIn-specific selectors
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
      if (text.length > 200) { body = text.slice(0, 20000); break; }
    }
  }

  // Instagram-specific
  if (url.includes('instagram.com')) {
    const sections = [
      'header', 'main', 'article', '.profile', 'body'
    ];
    for (const sel of sections) {
      const text = $(sel).text().replace(/\s+/g, ' ').trim();
      if (text.length > 100) { body = text.slice(0, 20000); break; }
    }
  }

  if (!body) {
    body = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 20000);
  }

  return [
    `URL: ${url}`,
    `TITLE: ${title}`,
    metas.length ? `META: ${metas.join(' | ')}` : '',
    jsonld.length ? `JSONLD: ${jsonld.join(' | ')}` : '',
    `VISIBLE_TEXT: ${body}`
  ].filter(Boolean).join('\n');
}

export async function scrapePublicPage(url) {
  const normalized = normalizeUrl(url);
  const u = new URL(normalized);

  if (!ALLOWED_HOSTS.includes(u.hostname)) {
    throw new Error('Only LinkedIn and Instagram public profile URLs are allowed.');
  }

  const isLinkedIn = u.hostname.includes('linkedin.com');
  const isInstagram = u.hostname.includes('instagram.com');

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'en-US',
      viewport: { width: 1280, height: 800 },
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      }
    });

    const page = await context.newPage();

    // Block heavy resources
    await page.route('**/*.{png,jpg,jpeg,gif,webp,mp4,mp3,woff,woff2,ttf,otf}', r => r.abort());
    await page.route('**/ads/**', r => r.abort());

    await page.goto(normalized, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await page.waitForTimeout(2500);

    let html = await page.content();
    let text = extractHtml(html, normalized);

    // If we hit a login wall, try to get at least public metadata
    const looksBlocked = text.length < 400 ||
      text.includes('Sign in') && text.includes('Join now') ||
      text.includes('Log in to Instagram') ||
      text.includes('You must be logged in');

    if (looksBlocked) {
      console.warn(`[scraper] Possible login wall on ${normalized}, trying meta-only extraction`);
      // Try fetching with basic headers only (faster, often gets public meta tags)
      try {
        const response = await page.evaluate(async (url) => {
          const r = await fetch(url, { headers: { 'Accept': 'text/html' } });
          return r.text();
        }, normalized);
        if (response && response.length > 500) {
          const altText = extractHtml(response, normalized);
          if (altText.length > text.length) text = altText;
        }
      } catch (_) {}

      // If still thin, note it but don't crash — model will work with available info
      if (text.length < 200) {
        text = `URL: ${normalized}\nNOTE: Public page limited — only public metadata available.\nMETA: Profile data from ${normalized}`;
      }
    }

    return { url: normalized, text };
  } finally {
    await browser.close();
  }
}
