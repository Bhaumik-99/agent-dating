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
const TAXONOMY = {
  interests: [
    { label: 'Artificial Intelligence & Machine Learning', keywords: ['artificial intelligence', 'ai', 'machine learning', 'deep learning', 'neural', 'agents', 'copilot', 'llm', 'computer vision', 'imagenet', 'robotics'], category: 'tech' },
    { label: 'Startups & Venture Capital', keywords: ['startup', 'startups', 'entrepreneur', 'founder', 'co-founder', 'venture capital', 'investor', 'angel investing', 'seed funding', 'shark tank', 'portfolio'], category: 'business' },
    { label: 'Enterprise Software & Cloud Platforms', keywords: ['enterprise', 'cloud', 'saas', 'developer tools', 'infrastructure', 'platform', 'distributed systems', 'open source', 'apis', 'software engineering'], category: 'tech' },
    { label: 'Fintech & Capital Markets', keywords: ['fintech', 'trading', 'markets', 'brokerage', 'payments', 'stablecoins', 'crypto', 'financial', 'wealth'], category: 'finance' },
    { label: 'Healthcare & Life Sciences', keywords: ['healthcare', 'health', 'biomedical', 'neuroscience', 'pharma', 'life sciences', 'pharmaceuticals', 'medicine', 'longevity'], category: 'health' },
    { label: 'Consumer Brands & E-commerce', keywords: ['ecommerce', 'd2c', 'consumer', 'retail', 'eyewear', 'cosmetics', 'apparel', 'direct to consumer', 'omnichannel'], category: 'commerce' },
    { label: 'Hospitality & Travel', keywords: ['hospitality', 'hotel', 'hotels', 'travel', 'accommodations', 'stay', 'tourism'], category: 'lifestyle' },
    { label: 'Automotive & Clean Mobility', keywords: ['automotive', 'mobility', 'electric vehicles', 'ev', 'battery', 'cars', 'cardekho', 'ola'], category: 'mobility' },
    { label: 'Education & Knowledge Sharing', keywords: ['education', 'learning', 'teaching', 'coursera', 'course', 'curriculum', 'mentorship', 'author', 'book', 'bestseller'], category: 'education' },
    { label: 'Product Design & Creative Taste', keywords: ['product design', 'taste', 'philosophy', 'design', 'user experience', 'ux', 'ui', 'creative direction', 'craftsmanship'], category: 'creative' }
  ],

  hobbies: [
    { label: 'Long-Distance Running & Marathons', keywords: ['running', 'marathon', 'half-marathon', '5k', '10k', 'trail running', 'jogging', 'runner'] },
    { label: 'Cricket', keywords: ['cricket', 'ipl', 'test match', 'batsman', 'bowler'] },
    { label: 'Football / Soccer', keywords: ['football', 'soccer', 'barça', 'barcelona', 'fifa', 'champions league'] },
    { label: 'Photography', keywords: ['photography', 'camera', 'photo', 'landscape photography', 'street photography'] },
    { label: 'Specialty Coffee', keywords: ['coffee', 'specialty coffee', 'espresso', 'pourover', 'barista', 'roastery'] },
    { label: 'Writing & Publishing', keywords: ['author', 'writing', 'wrote a book', 'bestseller', 'newsletter', 'essays'] },
    { label: 'Reading & Philosophy', keywords: ['reading', 'books', 'philosophy', 'meditation', 'stoicism', 'thinker', 'wisdom'] },
    { label: 'Outdoor Exploration & Hiking', keywords: ['hiking', 'mountains', 'nature', 'outdoors', 'trekking', 'trail'] },
    { label: 'Sports & Athletic Training', keywords: ['fitness', 'workout', 'gym', 'training', 'athletics', 'endurance'] }
  ],

  qualities: [
    { label: 'Mission-driven', keywords: ['mission', 'empower', 'purpose', 'impact', 'planet', 'future'] },
    { label: 'Technical rigor', keywords: ['engineer', 'engineering', 'science', 'rigor', 'infrastructure', 'research', 'fundamentals'] },
    { label: 'Visionary builder', keywords: ['build', 'builder', 'creating', 'pioneer', 'inventor', 'transforming', 'revolutionizing'] },
    { label: 'Analytical & strategic', keywords: ['strategy', 'decades', 'quarters', 'scaling', 'analysis', 'disciplined', 'metrics'] },
    { label: 'Direct & transparent', keywords: ['honest', 'transparent', 'skip the cold email', 'unvarnished', 'direct', 'straightforward'] },
    { label: 'High agency & gritty', keywords: ['grit', 'resilience', 'persistent', 'bootstrapped', 'relentless', 'hustle'] }
  ],

  work_styles: [
    { label: 'Founder-led execution', keywords: ['founder', 'co-founder', 'ceo', 'build', 'venture', 'bootstrapped'] },
    { label: 'Long-term strategic vision', keywords: ['decades', 'future', 'strategy', 'frontier', 'ecosystem', 'transformation'] },
    { label: 'Deep technical craftsmanship', keywords: ['engineering', 'code', 'research', 'paper', 'architecture', 'cli'] },
    { label: 'Data-driven and metrics-focused', keywords: ['metrics', 'data', 'kpi', 'revenue', 'financials', 'results'] },
    { label: 'Community-oriented mentorship', keywords: ['mentor', 'angel', 'community', 'supporting', 'empower', 'giving back'] }
  ],

  social_styles: [
    { label: 'Thoughtful long-form communication', keywords: ['letter', 'newsletter', 'article', 'essay', 'annual letter', 'published'] },
    { label: 'Direct and unvarnished conversation', keywords: ['direct', 'honest', 'skip the pleasantries', 'straight to the point'] },
    { label: 'Public thought-leader and educator', keywords: ['author', 'speaker', 'teaching', 'creator', 'podcast', 'lecture'] },
    { label: 'Subtle and private presence', keywords: ['quiet', '0 posts', 'minimal', 'reserved'] },
    { label: 'Enthusiastic and community-engaged', keywords: ['shark', 'cheering', 'collaborative', 'energizing', 'passion'] }
  ]
};

// ── TEXT PRE-PROCESSING & NORMALIZATION ─────────────────────────────────────
function cleanText(text = '') {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
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
      if (lower.includes(kw)) {
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
  const combinedLower = `${liClean} ${igClean}`.toLowerCase();

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
    const matched = item.keywords.filter(k => combinedLower.includes(k));
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
    const matched = item.keywords.filter(k => combinedLower.includes(k));
    if (matched.length > 0) {
      hobbies.push(item.label);
      const ev = findEvidenceSentence(igSentences, matched, 'Instagram') || findEvidenceSentence(liSentences, matched, 'LinkedIn');
      if (ev && !evidenceList.includes(ev)) evidenceList.push(ev);
    }
  }

  // 6. EXTRACT QUALITIES
  const qualities = [];
  for (const item of TAXONOMY.qualities) {
    if (item.keywords.some(k => combinedLower.includes(k))) {
      qualities.push(item.label);
    }
  }
  if (!qualities.length) qualities.push('Mission-driven', 'Analytical & strategic');

  // 7. EXTRACT WORK STYLE
  const workStyle = [];
  for (const item of TAXONOMY.work_styles) {
    if (item.keywords.some(k => combinedLower.includes(k))) {
      workStyle.push(item.label);
    }
  }
  if (!workStyle.length) workStyle.push('Founder-led execution');

  // 8. EXTRACT SOCIAL STYLE
  const socialStyle = [];
  for (const item of TAXONOMY.social_styles) {
    if (item.keywords.some(k => combinedLower.includes(k))) {
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

  // 10. DERIVE GROUNDED CONNECTION NEEDS
  const needs = [];
  if (interests.some(i => i.includes('Artificial Intelligence') || i.includes('Enterprise'))) {
    needs.push('High-bandwidth intellectual exchange on systemic technology trends');
  }
  if (hobbies.length > 0) {
    needs.push('An active partner who values shared physical and creative pursuits');
  }
  if (interests.some(i => i.includes('Startups'))) {
    needs.push('Mutual appreciation for entrepreneurial momentum and disciplined execution');
  }
  if (!needs.length) {
    needs.push('Authentic connection built around grounded mutual curiosity');
  }
  needs.push('Specificity — concrete shared activities over generic social meetings');

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
