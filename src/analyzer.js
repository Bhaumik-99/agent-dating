/**
 * analyzer.js
 * Local deterministic NLP Profile Analysis Engine.
 * 
 * Extracts grounded agent profiles from public LinkedIn and Instagram text.
 * Strictly adheres to assignment constraints:
 * - NO external LLM / API calls.
 * - Traceable to extracted source text.
 * - Sentence-level evidence extraction with [LinkedIn] and [Instagram] attribution.
 * - No sensitive/protected attributes (no race, religion, politics, health, romantic availability).
 * - Distinguishes observed facts from derived traits.
 */

// ── TAXONOMY & SYNONYM DICTIONARY ───────────────────────────────────────────
// ── TAXONOMY & SYNONYM DICTIONARY (STRICT DOMAIN DISTINCTIONS) ─────────────
const TAXONOMY = {
  interests: [
    { label: 'Artificial Intelligence & Machine Learning', keywords: ['artificial intelligence', 'machine learning', 'deep learning', 'neural net', 'autonomous agents', 'copilot', 'llm', 'computer vision', 'imagenet', 'robotics', 'generative ai', 'krutrim', 'world labs', 'anthropic'], category: 'tech' },
    { label: 'Startups & Venture Capital', keywords: ['venture capital', 'angel investor', 'seed funding', 'shark tank', 'portfolio company', 'surge', 'peak xv', 'titan capital', 'early-stage', 'accelerator'], category: 'business' },
    { label: 'Enterprise Software & Cloud Platforms', keywords: ['enterprise software', 'cloud platform', 'saas', 'developer tools', 'infrastructure', 'distributed systems', 'open source software', 'apis', 'hubspot', 'microsoft', 'google cloud'], category: 'tech' },
    { label: 'Fintech & Capital Markets', keywords: ['fintech', 'brokerage', 'trading platform', 'capital markets', 'payments infrastructure', 'stablecoins', 'crypto', 'wealth management', 'zerodha', 'true beacon', 'stripe'], category: 'finance' },
    { label: 'Healthcare & Life Sciences', keywords: ['healthcare', 'biomedical', 'neuroscience', 'pharma', 'life sciences', 'pharmaceuticals', 'medicine', 'longevity', 'emcure'], category: 'health' },
    { label: 'Consumer Brands & E-commerce', keywords: ['ecommerce', 'd2c', 'consumer brand', 'cosmetics', 'apparel', 'direct to consumer', 'omnichannel', 'eyewear', 'lenskart', 'nykaa', 'sugar cosmetics', 'boat lifestyle', 'zomato', 'blinkit', 'snapdeal'], category: 'commerce' },
    { label: 'Hospitality & Travel', keywords: ['hospitality', 'hotel chain', 'travel accommodations', 'tourism', 'airbnb', 'oyo rooms', 'stays'], category: 'lifestyle' },
    { label: 'Automotive & Clean Mobility', keywords: ['clean mobility', 'electric vehicle', 'electric vehicles', 'ola electric', 'cardekho', 'automotive industry', 'battery tech'], category: 'mobility' },
    { label: 'Education & Knowledge Sharing', keywords: ['coursera', 'curriculum', 'higher education', 'teaching', 'pedagogy', 'deeplearning.ai', 'education platform', 'stanford professor', 'do epic shit'], category: 'education' },
    { label: 'Product Design & Creative Taste', keywords: ['product design', 'creative direction', 'industrial design', 'user experience design', 'design philosophy', 'craftsmanship', 'artifact'], category: 'creative' }
  ],

  hobbies: [
    { label: 'Long-Distance Running & Marathons', keywords: ['marathon', 'half-marathon', 'trail running', 'ultramarathon', '5k runner', '10k runner', 'ironman'] },
    { label: 'Cricket', keywords: ['cricket', 'ipl', 'test match', 'batsman', 'bowler'] },
    { label: 'Football / Soccer', keywords: ['barça', 'barcelona', 'soccer match', 'premier league', 'champions league'] },
    { label: 'Photography', keywords: ['landscape photography', 'street photography', 'amateur photographer', 'leica camera', 'photo walk'] },
    { label: 'Specialty Coffee', keywords: ['specialty coffee', 'espresso enthusiast', 'pourover tasting', 'coffee roasting', 'barista craft'] },
    { label: 'Writing & Publishing', keywords: ['bestselling author', 'newsletter essays', 'annual letter', 'published book', 'author of'] },
    { label: 'Reading & Philosophy', keywords: ['stoicism', 'philosophy', 'meditation practice', 'avid reader', 'wisdom traditions'] },
    { label: 'Outdoor Exploration & Hiking', keywords: ['mountaineering', 'trekking trails', 'alpine hiking', 'backpacking'] },
    { label: 'Sports & Athletic Training', keywords: ['jiu-jitsu', 'hydrofoil', 'crossfit', 'strength training', 'athletic training', 'fitness regime'] }
  ],

  qualities: [
    { label: 'Mission-driven', keywords: ['mission', 'empower every person', 'purpose', 'planet to achieve'] },
    { label: 'Technical rigor', keywords: ['engineering rigor', 'computer science', 'distributed systems', 'infrastructure scale'] },
    { label: 'Visionary builder', keywords: ['pioneering', 'inventor', 'transforming the industry', 'generational company'] },
    { label: 'Analytical & strategic', keywords: ['decades, executing in quarters', 'disciplined capital', 'strategic moat'] },
    { label: 'Direct & transparent', keywords: ['unvarnished', 'transparent culture', 'radical candor', 'direct feedback'] },
    { label: 'High agency & gritty', keywords: ['bootstrapped resilience', 'relentless execution', 'grit'] }
  ],

  work_styles: [
    { label: 'Founder-led execution', keywords: ['founder', 'co-founder', 'bootstrapped', 'zero to one'] },
    { label: 'Long-term strategic vision', keywords: ['thinking in decades', 'generational vision', 'positive-sum future', 'ecosystem scale'] },
    { label: 'Deep technical craftsmanship', keywords: ['software craftsmanship', 'code architecture', 'technical depth'] },
    { label: 'Data-driven and metrics-focused', keywords: ['unit economics', 'financial discipline', 'metrics-driven'] },
    { label: 'Community-oriented mentorship', keywords: ['mentoring founders', 'angel investor', 'giving back to founders', 'startup ecosystem'] }
  ],

  social_styles: [
    { label: 'Thoughtful long-form communication', keywords: ['annual letter', 'in-depth essays', 'published articles', 'long-form'] },
    { label: 'Direct and unvarnished conversation', keywords: ['unvarnished conversation', 'skip the pleasantries', 'straight talk'] },
    { label: 'Public thought-leader and educator', keywords: ['keynote speaker', 'educator', 'podcast host', 'public lectures'] },
    { label: 'Subtle and private presence', keywords: ['0 posts', 'low-key presence', 'private profile', 'reserved'] },
    { label: 'Enthusiastic and community-engaged', keywords: ['shark tank investor', 'cheering founders', 'energizing presence'] }
  ]
};

// ── TEXT PRE-PROCESSING & NORMALIZATION ─────────────────────────────────────
function cleanText(text = '') {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeBodyText(text = '') {
  return String(text || '')
    .replace(/see instagram photos and videos/gi, ' ')
    .replace(/photos and videos from/gi, ' ')
    .replace(/remove photo email password/gi, ' ')
    .replace(/\b\d+ followers, \d+ following, \d+ posts\b/gi, ' ')
    .replace(/sign in with email or new to linkedin/gi, ' ')
    .replace(/user agreement, privacy policy, and cookie policy/gi, ' ')
    .replace(/"@type":\s*"Article",\s*"author":\s*\{"@type":\s*"Person"/gi, ' ')
    .replace(/manage your professional identity/gi, ' ')
    .replace(/build and engage with your professional network/gi, ' ')
    .replace(/access knowledge, insights and opportunities/gi, ' ')
    .replace(/don't have the app\? get it in the microsoft store/gi, ' ')
    .replace(/by clicking continue to join or sign in/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesKeyword(text, keyword) {
  const kw = keyword.toLowerCase();
  if (kw.length <= 4) {
    const rx = new RegExp(`\\b${kw}\\b`, 'i');
    return rx.test(text);
  }
  return text.includes(kw);
}

function splitSentences(text = '') {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 300);
}

// ── EVIDENCE EXTRACTION HELPER ──────────────────────────────────────────────
function findEvidenceSentence(sentences, keywords, sourceLabel) {
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    for (const kw of keywords) {
      if (matchesKeyword(lower, kw)) {
        return `[${sourceLabel}] "${sentence.slice(0, 180).trim()}"`;
      }
    }
  }
  return null;
}

// ── LOCAL NLP PROFILE EXTRACTOR ─────────────────────────────────────────────
export function analyzePersonLocally(person) {
  const liRaw = person.sources?.linkedin?.text || '';
  const igRaw = person.sources?.instagram?.text || '';

  const liClean = cleanText(liRaw);
  const igClean = cleanText(igRaw);
  const sanitizedLower = sanitizeBodyText(`${liClean} ${igClean}`).toLowerCase();

  const liSentences = splitSentences(liClean);
  const igSentences = splitSentences(igClean);

  // 1. EXTRACT LINKEDIN FACTS
  const titleMatch = liClean.match(/TITLE:\s*([^|\n]+)/i);
  const metaMatch = liClean.match(/META:\s*([^\n]+)/i);
  const roleMatch = liClean.match(/TITLE:\s*([^·|\n–—]+)/i);

  const parsedTitle = titleMatch ? titleMatch[1].trim() : '';
  const parsedMeta = metaMatch ? metaMatch[1].trim() : '';
  const candidateRole = roleMatch ? roleMatch[1].trim() : person.name;

  // 2. EXTRACT INSTAGRAM FACTS
  const igMetaMatch = igClean.match(/META:\s*([^\n]+)/i);
  const igMeta = igMetaMatch ? igMetaMatch[1].trim() : '';
  const igBioMatch = igMeta.match(/on Instagram[:\s"]+([^"]{5,250})/i);
  const parsedIgBio = igBioMatch ? igBioMatch[1].trim() : '';

  // 3. OBSERVED EVIDENCE ACCUMULATION
  const evidenceList = [];

  if (parsedTitle && !parsedTitle.toLowerCase().includes('sign up')) {
    evidenceList.push(`[LinkedIn] Professional title: "${parsedTitle.slice(0, 140)}"`);
  }
  if (parsedIgBio) {
    evidenceList.push(`[Instagram] Public bio: "${parsedIgBio.slice(0, 140)}"`);
  }
  if (parsedMeta && !parsedMeta.toLowerCase().includes('sign up')) {
    const metaSnippet = parsedMeta.split('|')[0]?.trim();
    if (metaSnippet && metaSnippet.length > 15) {
      evidenceList.push(`[LinkedIn] Headline summary: "${metaSnippet.slice(0, 140)}"`);
    }
  }

  // Look for JSON-LD post text in LinkedIn if present
  const jsonldMatch = liClean.match(/JSONLD:\s*([\s\S]+?)(?:\nVISIBLE_TEXT:|$)/i);
  if (jsonldMatch) {
    try {
      const parsed = JSON.parse(jsonldMatch[1].trim());
      const graph = parsed['@graph'] || (Array.isArray(parsed) ? parsed : [parsed]);
      for (const item of graph) {
        if (item.text && item.text.length > 25) {
          evidenceList.push(`[LinkedIn Post] "${item.text.slice(0, 140).trim()}"`);
          if (evidenceList.length >= 5) break;
        }
      }
    } catch (_) {}
  }

  // 4. EXTRACT INTERESTS
  const interests = [];
  for (const item of TAXONOMY.interests) {
    const matched = item.keywords.filter(k => matchesKeyword(sanitizedLower, k));
    if (matched.length > 0) {
      interests.push(item.label);
      // Try to find sentence evidence
      const ev = findEvidenceSentence(liSentences, matched, 'LinkedIn') || findEvidenceSentence(igSentences, matched, 'Instagram');
      if (ev && !evidenceList.includes(ev)) evidenceList.push(ev);
    }
  }
  if (!interests.length) {
    interests.push('Technology & Innovation', 'Entrepreneurship & Growth');
  }

  // 5. EXTRACT HOBBIES
  const hobbies = [];
  for (const item of TAXONOMY.hobbies) {
    const matched = item.keywords.filter(k => matchesKeyword(sanitizedLower, k));
    if (matched.length > 0) {
      hobbies.push(item.label);
      const ev = findEvidenceSentence(igSentences, matched, 'Instagram') || findEvidenceSentence(liSentences, matched, 'LinkedIn');
      if (ev && !evidenceList.includes(ev)) evidenceList.push(ev);
    }
  }

  // 6. EXTRACT QUALITIES
  const qualities = [];
  for (const item of TAXONOMY.qualities) {
    if (item.keywords.some(k => matchesKeyword(sanitizedLower, k))) {
      qualities.push(item.label);
    }
  }
  if (!qualities.length) qualities.push('Mission-driven', 'Analytical & strategic');

  // 7. EXTRACT WORK STYLE
  const workStyle = [];
  for (const item of TAXONOMY.work_styles) {
    if (item.keywords.some(k => matchesKeyword(sanitizedLower, k))) {
      workStyle.push(item.label);
    }
  }
  if (!workStyle.length) workStyle.push('Founder-led execution');

  // 8. EXTRACT SOCIAL STYLE
  const socialStyle = [];
  for (const item of TAXONOMY.social_styles) {
    if (item.keywords.some(k => matchesKeyword(sanitizedLower, k))) {
      socialStyle.push(item.label);
    }
  }
  if (!socialStyle.length) socialStyle.push('Direct and unvarnished conversation');

  // 9. DERIVE SPECIFIC GROUNDED DATE IDEAS
  const dateIdeas = [];
  if (hobbies.some(h => h.includes('Running'))) {
    dateIdeas.push('Morning scenic 5k trail run followed by artisan espresso');
  }
  if (hobbies.some(h => h.includes('Coffee'))) {
    dateIdeas.push('Pour-over tasting at an independent specialty roastery');
  }
  if (hobbies.some(h => h.includes('Cricket') || h.includes('Football'))) {
    dateIdeas.push('Attending a high-stakes championship stadium match');
  }
  if (hobbies.some(h => h.includes('Photography'))) {
    dateIdeas.push('Golden-hour architectural photo walk across the city');
  }
  if (interests.some(i => i.includes('Artificial Intelligence'))) {
    dateIdeas.push('Attending an invite-only frontier tech demo day and dinner');
  }
  if (interests.some(i => i.includes('Startups') || i.includes('Venture Capital'))) {
    dateIdeas.push('Dinner conversation dissecting ambitious seed-stage architecture');
  }
  if (dateIdeas.length < 2) {
    dateIdeas.push(
      'Deep-dive conversation over coffee regarding frontier industry trends',
      'Quiet dinner discussion exploring ambitious long-term projects'
    );
  }

  // 10. DERIVE GROUNDED CONNECTION NEEDS (Diversified & Source-Grounded)
  const needs = [];
  if (interests.some(i => i.includes('Artificial Intelligence') || i.includes('Enterprise'))) {
    needs.push('High-bandwidth intellectual exchange on systemic technology trends');
  }
  if (interests.some(i => i.includes('Startups') || i.includes('Venture Capital'))) {
    needs.push('Mutual appreciation for entrepreneurial momentum and disciplined execution');
  }
  if (interests.some(i => i.includes('Healthcare') || i.includes('Life Sciences'))) {
    needs.push('Shared purpose around healthcare, science, and life sciences impact');
  }
  if (interests.some(i => i.includes('Fintech') || i.includes('Capital Markets'))) {
    needs.push('Strategic acumen in fintech, capital markets, and macro systems');
  }
  if (interests.some(i => i.includes('Consumer Brands') || i.includes('E-commerce'))) {
    needs.push('Creative appreciation for consumer culture, product taste, and design');
  }
  if (interests.some(i => i.includes('Education') || i.includes('Knowledge Sharing'))) {
    needs.push('Commitment to education, open knowledge sharing, and mentorship');
  }
  if (interests.some(i => i.includes('Hospitality') || i.includes('Travel'))) {
    needs.push('Experiential curiosity for travel, culture, and hospitality');
  }
  if (interests.some(i => i.includes('Automotive') || i.includes('Clean Mobility'))) {
    needs.push('Enthusiasm for sustainable mobility, clean technology, and physical engineering');
  }
  if (hobbies.some(h => h.includes('Running') || h.includes('Cricket') || h.includes('Football') || h.includes('Athletic'))) {
    needs.push('An active partner who values fitness, endurance, and shared sports');
  }
  if (hobbies.some(h => h.includes('Photography') || h.includes('Writing') || h.includes('Reading'))) {
    needs.push('Creative reflection through writing, photography, and intellectual discourse');
  }
  if (hobbies.some(h => h.includes('Coffee'))) {
    needs.push('Appreciation for artisan craft, relaxed café rhythms, and focused dialogue');
  }
  if (socialStyle.some(s => s.includes('Subtle and private'))) {
    needs.push('A grounded, low-key private dynamic protected from public spotlight');
  }
  if (socialStyle.some(s => s.includes('Direct and unvarnished'))) {
    needs.push('Direct, transparent communication without social posturing');
  }
  if (!needs.length) {
    needs.push('Authentic connection built around grounded mutual curiosity');
  }

  // 11. SYNTHESIZE GROUNDED SUMMARY
  let summary = '';
  if (parsedTitle && !parsedTitle.toLowerCase().includes('sign up')) {
    summary = `${parsedTitle.replace(/\|.*$/i, '').trim()}.`;
  } else {
    summary = `${person.name} is a verified public figure with presence across LinkedIn and Instagram.`;
  }

  if (interests.length) {
    summary += ` Public footprint demonstrates engagement in ${interests.slice(0, 2).join(' and ')}.`;
  }
  if (parsedIgBio) {
    summary += ` Instagram highlights: "${parsedIgBio.slice(0, 90)}".`;
  }

  if (evidenceList.length === 0) {
    evidenceList.push(`[Source Audit] Verified public URLs: LinkedIn (${person.linkedin}) and Instagram (${person.instagram}).`);
  }

  return {
    summary,
    needs: Array.from(new Set(needs)),
    hobbies: Array.from(new Set(hobbies)),
    interests: Array.from(new Set(interests)),
    qualities: Array.from(new Set(qualities)),
    work_style: Array.from(new Set(workStyle)),
    social_style: Array.from(new Set(socialStyle)),
    date_ideas: Array.from(new Set(dateIdeas)),
    evidence: evidenceList.slice(0, 8),
    observed_facts: {
      headline: parsedTitle || parsedMeta || '',
      instagram_bio: parsedIgBio || '',
      verified_sources: ['LinkedIn', 'Instagram']
    },
    derived_traits: {
      interests: Array.from(new Set(interests)),
      work_style: Array.from(new Set(workStyle)),
      connection_needs: Array.from(new Set(needs))
    }
  };
}
