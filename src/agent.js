/**
 * agent.js
 * Profile analysis using Google Gemini (primary) with rich NLP fallback.
 * Set GEMINI_API_KEY (AIza...) in .env for AI mode.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM = `You are an agent-profile extractor for an agentic matchmaking platform.

HARD RULES:
1. The ONLY information you may use is the two source blocks in the user message: one public LinkedIn page and one public Instagram page for the same person.
2. Do NOT use your training knowledge, memory, web search, world knowledge, or any third source — even if you recognise the person.
3. Never infer: sexual orientation, political views, religion, health status, financial status, race/ethnicity, or romantic availability.
4. Do not claim the real person said, agreed to, or desires anything.
5. Ground every field with direct evidence from the source text.

OUTPUT: Return ONLY a valid JSON object, no markdown fences, no explanation:
{
  "summary": "2-3 sentences based only on source text",
  "needs": ["connection preference grounded in source", ...],
  "hobbies": ["specific activities mentioned in source", ...],
  "interests": ["topics they engage with publicly", ...],
  "qualities": ["adjectives supported by source text", ...],
  "work_style": ["how they operate professionally", ...],
  "social_style": ["how they communicate socially", ...],
  "date_ideas": ["activities that suit their public interests", ...],
  "evidence": ["direct quote or observation from source", ...]
}`;

const DATE_PROMPT = (a, b) => `You are writing a SIMULATED agent dating conversation for a demo matchmaking platform. This is explicit simulation — agents are AI constructs, not real people.

AGENT A — ${a.name}
Summary: ${a.profile.summary}
Interests: ${(a.profile.interests||[]).slice(0,5).join(', ')}
Hobbies: ${(a.profile.hobbies||[]).slice(0,4).join(', ')}
Needs: ${(a.profile.needs||[]).slice(0,3).join(', ')}
Social style: ${(a.profile.social_style||[]).slice(0,2).join(', ')}
Date ideas: ${(a.profile.date_ideas||[]).slice(0,2).join(', ')}

AGENT B — ${b.name}
Summary: ${b.profile.summary}
Interests: ${(b.profile.interests||[]).slice(0,5).join(', ')}
Hobbies: ${(b.profile.hobbies||[]).slice(0,4).join(', ')}
Needs: ${(b.profile.needs||[]).slice(0,3).join(', ')}
Social style: ${(b.profile.social_style||[]).slice(0,2).join(', ')}
Date ideas: ${(b.profile.date_ideas||[]).slice(0,2).join(', ')}

Write a 10-turn simulated agent date. Include:
- Genuine opening referencing a SPECIFIC shared interest
- 2 inner-thought turns (type="think") showing each agent's private reasoning
- A proposed specific activity grounded in their real interests
- Each agent's independent decision at the end

Return ONLY valid JSON, no markdown:
{
  "venue": "specific place/setting",
  "activity": "specific activity",
  "shared_interest": "the key shared signal",
  "turns": [{"agent": "name", "type": "speak"|"think", "text": "..."}, ...],
  "decision_a": {"continue": true|false, "reason": "..."},
  "decision_b": {"continue": true|false, "reason": "..."},
  "chemistry_score": 0-100,
  "disclaimer": "Simulated agent dialogue — not statements made by either real person."
}`;

function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey || apiKey.length < 10) return null;
  return new GoogleGenerativeAI(apiKey);
}

async function callGemini(prompt, temperature = 0.3) {
  const genai = getGemini();
  if (!genai) return null;

  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const model = genai.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature,
      responseMimeType: 'application/json',
    }
  });

  const result = await model.generateContent(`${SYSTEM}\n\n${prompt}`);
  let text = result.response.text().trim();
  // Strip code fences if present
  text = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  return JSON.parse(text);
}

const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-2.5-flash'
].filter(Boolean);

export async function analyzePerson(person) {
  const liText = (person.sources.linkedin?.text || '').slice(0, 12000);
  const igText = (person.sources.instagram?.text || '').slice(0, 12000);

  const userPrompt = `PERSON: ${person.name} (ID: ${person.id})

SOURCE A — LINKEDIN (${person.sources.linkedin?.url}):
${liText || '(no content retrieved)'}

SOURCE B — INSTAGRAM (${person.sources.instagram?.url}):
${igText || '(no content retrieved)'}

Analyze the above two sources only. Do not use external knowledge.`;

  const genai = getGemini();
  if (genai) {
    for (const modelName of CANDIDATE_MODELS) {
      try {
        const model = genai.getGenerativeModel({
          model: modelName,
          generationConfig: { temperature: 0.3, responseMimeType: 'application/json' }
        });
        const result = await model.generateContent(`${SYSTEM}\n\n${userPrompt}`);
        let text = result.response.text().trim();
        text = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
        return JSON.parse(text);
      } catch (err) {
        console.warn(`[agent] Gemini model ${modelName} error:`, err.message?.slice(0, 80));
      }
    }
  }

  // Rich NLP fallback — extracts real signal from scraped text
  return richFallbackAnalysis(person);
}

export async function generateDateDialogue(a, b) {
  const genai = getGemini();
  if (genai) {
    for (const modelName of CANDIDATE_MODELS) {
      try {
        const model = genai.getGenerativeModel({
          model: modelName,
          generationConfig: { temperature: 0.7, responseMimeType: 'application/json' }
        });
        const result = await model.generateContent(DATE_PROMPT(a, b));
        let text = result.response.text().trim();
        text = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
        return JSON.parse(text);
      } catch (err) {
        console.warn(`[agent] Date model ${modelName} error:`, err.message?.slice(0, 80));
      }
    }
  }

  return staticDate(a, b);
}

// =====================================================================
// RICH NLP FALLBACK — extracts real signal from scraped LinkedIn/IG text
// =====================================================================
function richFallbackAnalysis(person) {
  const raw = `${person.sources.linkedin?.text || ''} ${person.sources.instagram?.text || ''}`;
  const lower = raw.toLowerCase();
  const liMeta = person.sources.linkedin?.text || '';
  const igMeta = person.sources.instagram?.text || '';

  // Extract LinkedIn title line (has real job info)
  const titleMatch = liMeta.match(/TITLE:\s*(.+)/);
  const metaMatch = liMeta.match(/META:\s*(.+)/);
  const igMetaMatch = igMeta.match(/META:\s*(.+)/);

  // Extract actual post text from JSON-LD (LinkedIn exposes real post content in structured data)
  const jsonldPosts = [];
  const jsonldSection = liMeta.match(/JSONLD:\s*([\s\S]+?)(?:\nVISIBLE_TEXT:|$)/);
  if (jsonldSection) {
    try {
      const parsed = JSON.parse(jsonldSection[1].trim());
      const items = parsed['@graph'] || (Array.isArray(parsed) ? parsed : [parsed]);
      for (const item of items) {
        if (item.text) jsonldPosts.push(item.text.slice(0, 600));
      }
    } catch (_) {}
  }
  const postText = jsonldPosts.join(' ').toLowerCase();

  const titleLine = titleMatch?.[1]?.trim() || '';
  const metaLine = metaMatch?.[1]?.trim() || '';
  const igLine = igMetaMatch?.[1]?.trim() || '';

  // Extract bio from Instagram meta (often has real bio text)
  // e.g. "Dad, Barça/football, Cricket/IPL, CEO @Google"
  const igBioMatch = igLine.match(/on Instagram[:\s"]+([^"]{10,200})/i);
  const igBio = igBioMatch?.[1]?.trim() || '';

  // Extract company/role from LinkedIn title
  // "Satya Nadella - Microsoft | LinkedIn" → "Microsoft"
  const liParts = titleLine.replace(/\s*[\|·–—]\s*LinkedIn\s*$/i, '').split(/[\|·–—]/);
  const personRole = liParts[0]?.trim() || '';
  const personCompany = liParts[1]?.trim() || '';

  // Extract experience/education from LinkedIn meta
  // "Experience: DeepLearning.AI · Education: UC Berkeley · Location: Palo Alto"
  const expMatch = metaLine.match(/Experience:\s*([^·\|]+)/i);
  const eduMatch = metaLine.match(/Education:\s*([^·\|]+)/i);
  const locMatch = metaLine.match(/Location:\s*([^·\|]+)/i);

  const experience = expMatch?.[1]?.trim() || personCompany;
  const education = eduMatch?.[1]?.trim() || '';
  const location = locMatch?.[1]?.trim() || '';

  // ── INTEREST DETECTION — searches scraped text + real post content ────
  const searchText = lower + ' ' + postText;
  const interestMap = {
    'artificial intelligence': ['ai', 'artificial intelligence', 'machine learning', 'llm', 'deep learning', 'neural', 'nlp', 'chatgpt', 'openai', 'genai', 'generative ai'],
    'startups & entrepreneurship': ['startup', 'entrepreneur', 'founder', 'venture', 'bootstrapped', 'co-founder'],
    'product & technology': ['product', 'software', 'engineering', 'developer', 'tech', 'saas', 'platform'],
    'investing & finance': ['invest', 'finance', 'fund', 'portfolio', 'market', 'trading', 'fintech', 'capital'],
    'leadership & management': ['leadership', 'ceo', 'executive', 'management', 'strategy', 'team building'],
    'education & learning': ['education', 'teaching', 'learning', 'course', 'university', 'student', 'teacher'],
    'climate & sustainability': ['climate', 'sustainability', 'environment', 'clean energy', 'ev', 'electric'],
    'design & creativity': ['design', 'creative', 'art', 'ux', 'ui', 'visual', 'brand', 'content'],
    'health & wellness': ['health', 'wellness', 'mental health', 'meditation', 'mindfulness', 'nutrition'],
    'books & writing': ['book', 'writing', 'author', 'literature', 'read', 'publish'],
    'cricket': ['cricket', 'ipl', 'bcci', 'test match'],
    'football': ['football', 'soccer', 'fifa', 'barça', 'barcelona', 'premier league', 'barca'],
    'running & fitness': ['running', 'marathon', 'fitness', 'gym', 'workout', 'triathlon', 'cycling'],
    'travel': ['travel', 'explore', 'world tour', 'adventure', 'expedition'],
    'music': ['music', 'guitar', 'piano', 'concert', 'spotify', 'playlist'],
    'photography': ['photo', 'camera', 'photography', 'instagram', 'visual storytelling'],
    'consumer brands': ['brand', 'consumer', 'retail', 'd2c', 'direct to consumer', 'marketing'],
  };

  const interests = [];
  for (const [label, keywords] of Object.entries(interestMap)) {
    if (keywords.some(k => searchText.includes(k))) interests.push(label);
  }

  // ── HOBBY DETECTION ─────────────────────────────────────────────────
  const hobbyMap = {
    'cricket': ['cricket', 'ipl'],
    'football / soccer': ['football', 'soccer', 'barca', 'barça', 'premier league', 'fifa'],
    'running': ['running', 'marathon', 'half marathon'],
    'cycling': ['cycling', 'bike', 'bicycle'],
    'reading': ['reading', 'book club', 'avid reader'],
    'writing': ['writing', 'author', 'blogger'],
    'yoga': ['yoga', 'pilates'],
    'photography': ['photography', 'photographer'],
    'travel': ['travel', 'backpacking', 'world tour'],
    'cooking': ['cooking', 'chef', 'culinary', 'recipe', 'food'],
    'gaming': ['gaming', 'gamer', 'esports'],
    'hiking': ['hiking', 'trekking', 'mountains'],
  };

  const hobbies = [];
  for (const [label, keywords] of Object.entries(hobbyMap)) {
    if (keywords.some(k => searchText.includes(k))) hobbies.push(label);
  }

  // ── QUALITY DETECTION ───────────────────────────────────────────────
  const qualityMap = {
    'builder-minded': ['build', 'built', 'founder', 'create', 'maker'],
    'curious': ['curious', 'learn', 'explore', 'why', 'question'],
    'impact-driven': ['impact', 'change', 'mission', 'purpose', 'vision'],
    'analytical': ['data', 'metrics', 'research', 'analysis', 'evidence'],
    'empathetic': ['empathy', 'empathetic', 'human', 'people first', 'community'],
    'risk-taker': ['risk', 'bold', 'disrupt', 'unconventional', 'contrarian'],
    'long-term thinker': ['long-term', 'decade', 'patient', 'sustainable'],
    'communicator': ['speak', 'write', 'communicate', 'articulate', 'story'],
  };

  const qualities = [];
  for (const [label, keywords] of Object.entries(qualityMap)) {
    if (keywords.some(k => searchText.includes(k))) qualities.push(label);
  }
  if (!qualities.length) qualities.push('goal-oriented', 'curious');

  // ── BUILD WORK STYLE ────────────────────────────────────────────────
  const workStyle = [];
  if (lower.includes('founder') || lower.includes('startup')) workStyle.push('founder mindset');
  if (lower.includes('scale') || lower.includes('growth')) workStyle.push('growth-oriented');
  if (lower.includes('data') || lower.includes('research')) workStyle.push('data-driven');
  if (lower.includes('team') || lower.includes('collaborate')) workStyle.push('collaborative');
  if (lower.includes('build') || lower.includes('ship')) workStyle.push('builder');
  if (!workStyle.length) workStyle.push('strategic thinker');

  // ── BUILD SOCIAL STYLE ──────────────────────────────────────────────
  const socialStyle = [];
  if (igBio.includes(',') && igBio.length > 30) socialStyle.push('open about passions and identity');
  if (lower.includes('speak') || lower.includes('keynote') || lower.includes('ted')) socialStyle.push('public speaker');
  if (lower.includes('mentor') || lower.includes('coach')) socialStyle.push('mentor');
  if (lower.includes('podcast') || lower.includes('interview')) socialStyle.push('long-form conversation');
  if (!socialStyle.length) socialStyle.push('conversation-led');

  // ── DATE IDEAS based on actual interests ─────────────────────────────
  const dateIdeas = [];
  if (interests.includes('cricket')) dateIdeas.push('Watch an IPL match together');
  if (interests.includes('football')) dateIdeas.push('Catch a live football match');
  if (interests.includes('artificial intelligence')) dateIdeas.push('Attend an AI demo day or research talk');
  if (interests.includes('books & writing')) dateIdeas.push('Spend a morning at a bookshop');
  if (interests.includes('running & fitness')) dateIdeas.push('Morning run followed by breakfast');
  if (interests.includes('travel')) dateIdeas.push('Weekend trip somewhere neither has been');
  if (hobbies.includes('cooking')) dateIdeas.push('Cook a meal together from scratch');
  if (dateIdeas.length < 2) dateIdeas.push('Coffee + deep conversation on a shared topic', 'Attend a talk or panel together');

  // ── NEEDS based on profile signals ───────────────────────────────────
  const needs = [];
  if (interests.includes('artificial intelligence') || interests.includes('education & learning'))
    needs.push('Intellectually stimulating conversation on big ideas');
  if (hobbies.length > 1 || interests.includes('running & fitness') || interests.includes('cricket'))
    needs.push('An active partner who appreciates shared experiences');
  if (lower.includes('community') || lower.includes('mentor') || lower.includes('give back'))
    needs.push('Shared commitment to impact beyond personal success');
  if (!needs.length) needs.push('Authentic connection built around real shared interests');
  needs.push('Specificity — a concrete shared activity, not a generic meeting');

  // ── EVIDENCE quotes ──────────────────────────────────────────────────
  const evidence = [];
  if (titleLine) evidence.push(`LinkedIn title: "${titleLine.slice(0,120)}"`);
  if (igBio) evidence.push(`Instagram bio: "${igBio.slice(0,120)}"`);
  if (experience) evidence.push(`Experience: "${experience}"`);
  if (education) evidence.push(`Education: "${education}"`);
  if (location) evidence.push(`Location: ${location}`);
  if (!evidence.length) evidence.push('Extracted from available public meta tags on the two supplied URLs.');

  // ── SUMMARY ─────────────────────────────────────────────────────────
  let summary = '';
  if (personRole && experience) {
    summary = `${personRole} at ${experience}`;
    if (education) summary += `, educated at ${education}`;
    if (location) summary += `, based in ${location}`;
    summary += '.';
  } else if (titleLine) {
    summary = `${titleLine.slice(0, 150)}.`;
  } else {
    summary = `Profile extracted from public LinkedIn and Instagram. ${interests.length ? `Public interests: ${interests.slice(0,3).join(', ')}.` : ''}`;
  }

  if (igBio) summary += ` Instagram bio: "${igBio.slice(0, 100)}".`;

  return {
    summary,
    needs,
    hobbies,
    interests: interests.length ? interests : ['technology', 'entrepreneurship'],
    qualities,
    work_style: workStyle,
    social_style: socialStyle,
    date_ideas: dateIdeas,
    evidence
  };
}

function staticDate(a, b) {
  const sharedInterests = (a.profile.interests || []).filter(x =>
    (b.profile.interests || []).map(y => y.toLowerCase()).includes(x.toLowerCase())
  );
  const shared = sharedInterests[0] || a.profile.interests?.[0] || 'technology';
  const place = a.profile.date_ideas?.[0] || 'coffee and a walk';

  return {
    venue: place.includes('match') ? 'Sports venue' : place.includes('run') ? 'Running trail' : 'Coffee + conversation',
    activity: place,
    shared_interest: shared,
    turns: [
      { agent: a.name, type: 'speak', text: `Your profile flagged "${shared}" clearly. For you, is that a professional interest or does it bleed into your personal time?` },
      { agent: b.name, type: 'think', text: `Interesting — they went straight to something specific. That's a good sign.` },
      { agent: b.name, type: 'speak', text: `Both, honestly. It's harder to separate them than people think. What draws you to it?` },
      { agent: a.name, type: 'think', text: `They didn't give a polished answer. That's more interesting.` },
      { agent: a.name, type: 'speak', text: `The fact that it bleeds in. I'm less interested in people who clock out mentally. I'd suggest we meet at: ${place}.` },
      { agent: b.name, type: 'speak', text: `That's a more thoughtful proposal than I expected. What would make it a good use of time for you?` },
      { agent: a.name, type: 'speak', text: `If I leave with one new way to think about something I already care about. That's a high bar, but a clear one.` },
      { agent: b.name, type: 'speak', text: `I can work with that. I'd want to see if the intellectual engagement holds past the surface level. Usually obvious within 20 minutes.` },
      { agent: a.name, type: 'speak', text: `Agreed. Based on the public signal overlap, I'd continue. Decision: continue.` },
      { agent: b.name, type: 'speak', text: `Same. The specificity here is real, not performed. Decision: continue.` }
    ],
    decision_a: { continue: true, reason: `Real overlap on "${shared}" and compatible intellectual engagement style.` },
    decision_b: { continue: true, reason: `Specific, honest exchange signals genuine compatibility on what matters.` },
    chemistry_score: Math.min(95, 55 + sharedInterests.length * 8),
    disclaimer: 'Simulated agent dialogue — not statements made by either real person.'
  };
}
