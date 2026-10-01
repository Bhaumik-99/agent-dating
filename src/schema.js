/**
 * schema.js
 * Strict data structures and boundary validators for the Agentic Dating platform.
 * 
 * Boundary rule:
 * Every person has EXACTLY two sources: one public LinkedIn URL and one public Instagram URL.
 * No third-party data sources, no external LLM dependencies, no fabricated facts.
 */

export function emptySource(url = '', status = 'uninitialized', text = '') {
  return {
    url: String(url || '').trim(),
    status, // 'verified_public' | 'limited' | 'failed'
    text: String(text || '').trim(),
    retrieved_at: new Date().toISOString()
  };
}

export function emptyProfile() {
  return {
    summary: '',
    needs: [],
    hobbies: [],
    interests: [],
    qualities: [],
    work_style: [],
    social_style: [],
    date_ideas: [],
    evidence: [] // Evidence snippets with source attribution, e.g. "[LinkedIn] ..."
  };
}

export function createPerson(id, name, linkedinUrl, instagramUrl) {
  validateSourceUrls(linkedinUrl, instagramUrl);

  return {
    id: String(id),
    name: String(name).trim(),
    linkedin: String(linkedinUrl).trim(),
    instagram: String(instagramUrl).trim(),
    sources: {
      linkedin: emptySource(linkedinUrl, 'pending'),
      instagram: emptySource(instagramUrl, 'pending')
    },
    profile: emptyProfile(),
    created_at: new Date().toISOString()
  };
}

/**
 * Strict source boundary validation.
 * Accepts ONLY valid public LinkedIn profile URLs and valid public Instagram profile URLs.
 */
export function validateSourceUrls(linkedinUrl, instagramUrl) {
  if (!linkedinUrl || typeof linkedinUrl !== 'string') {
    throw new Error('LinkedIn URL is required.');
  }
  if (!instagramUrl || typeof instagramUrl !== 'string') {
    throw new Error('Instagram URL is required.');
  }

  let liParsed, igParsed;
  try {
    liParsed = new URL(linkedinUrl);
  } catch {
    throw new Error(`Invalid LinkedIn URL: "${linkedinUrl}". Must be a valid HTTPS URL.`);
  }

  try {
    igParsed = new URL(instagramUrl);
  } catch {
    throw new Error(`Invalid Instagram URL: "${instagramUrl}". Must be a valid HTTPS URL.`);
  }

  // Enforce host validation
  const liHost = liParsed.hostname.toLowerCase().replace(/^www\./, '');
  if (liHost !== 'linkedin.com') {
    throw new Error(`Unsupported source domain: "${liParsed.hostname}". Only public linkedin.com profiles are permitted.`);
  }

  if (!/^\/in\/[a-zA-Z0-9_\-\.%]+\/?$/i.test(liParsed.pathname)) {
    throw new Error(`Invalid LinkedIn profile path: "${liParsed.pathname}". Must match /in/<username>/`);
  }

  const igHost = igParsed.hostname.toLowerCase().replace(/^www\./, '');
  if (igHost !== 'instagram.com') {
    throw new Error(`Unsupported source domain: "${igParsed.hostname}". Only public instagram.com profiles are permitted.`);
  }

  const igPath = igParsed.pathname.replace(/^\/|\/$/g, '');
  const reservedIgPaths = new Set(['p', 'reel', 'stories', 'explore', 'direct', 'accounts', 'developer', 'about', 'legal']);
  if (!igPath || reservedIgPaths.has(igPath.split('/')[0].toLowerCase()) || !/^[a-zA-Z0-9_\.]+$/i.test(igPath)) {
    throw new Error(`Invalid Instagram profile URL: "${instagramUrl}". Must be a public user profile.`);
  }

  return true;
}

/**
 * Normalize and clean URLs
 */
export function normalizeUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    u.search = '';
    u.hash = '';
    let p = u.pathname;
    if (!p.endsWith('/')) p += '/';
    return `${u.protocol}//${u.hostname.toLowerCase()}${p}`;
  } catch {
    return urlStr;
  }
}
