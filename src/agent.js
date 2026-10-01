import OpenAI from 'openai';

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const SYSTEM = `You are an agent-profile extractor for an agentic matchmaking platform.

HARD RULES:
1. The ONLY information you may use is the two source blocks in the user message: one public LinkedIn page and one public Instagram page for the same person.
2. Do NOT use your training knowledge, memory, web search, world knowledge, or any third source — even if you recognise the person.
3. Never infer: sexual orientation, political views, religion, health status, financial status, race/ethnicity, or romantic availability.
4. Do not claim the real person said, agreed to, or desires anything.
5. Ground every field with direct evidence from the source text. Quote the evidence briefly.

OUTPUT CONTRACT:
- summary: 2–3 sentence distillation of the person's public identity based ONLY on source text.
- needs: connection preferences grounded in public evidence (e.g. "intellectually stimulating conversation about AI", "collaborative creative projects"). AVOID romantic/sexual needs.
- hobbies: specific activities mentioned or strongly implied by source text.
- interests: topics, fields, causes they engage with publicly.
- qualities: adjectives clearly supported by how they present themselves on the two sources.
- work_style: how they operate professionally, based on evidence.
- social_style: how they communicate and engage socially, based on evidence.
- date_ideas: activities that would suit their public interests — creative, specific, grounded.
- evidence: 3–5 direct quotes or direct observations from source text supporting the above.

If source text is thin (login wall), produce a minimal honest profile noting limited evidence.`;

const JSON_SCHEMA = {
  name: 'agent_profile',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      summary: { type: 'string' },
      needs: { type: 'array', items: { type: 'string' } },
      hobbies: { type: 'array', items: { type: 'string' } },
      interests: { type: 'array', items: { type: 'string' } },
      qualities: { type: 'array', items: { type: 'string' } },
      work_style: { type: 'array', items: { type: 'string' } },
      social_style: { type: 'array', items: { type: 'string' } },
      date_ideas: { type: 'array', items: { type: 'string' } },
      evidence: { type: 'array', items: { type: 'string' } }
    },
    required: ['summary', 'needs', 'hobbies', 'interests', 'qualities', 'work_style', 'social_style', 'date_ideas', 'evidence']
  }
};

export async function analyzePerson(person) {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[agent] No OPENAI_API_KEY — using fallback analysis');
    return fallbackAnalysis(person);
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const liText = person.sources.linkedin.text || '(no content retrieved)';
  const igText = person.sources.instagram.text || '(no content retrieved)';

  const prompt = `PERSON: ${person.name} (ID: ${person.id})

SOURCE A — LINKEDIN (${person.sources.linkedin.url}):
${liText.slice(0, 12000)}

SOURCE B — INSTAGRAM (${person.sources.instagram.url}):
${igText.slice(0, 12000)}

Analyze the above two sources only. Do not use external knowledge.`;

  try {
    const r = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      response_format: { type: 'json_schema', json_schema: JSON_SCHEMA },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: prompt }
      ]
    });

    return JSON.parse(r.choices[0].message.content);
  } catch (err) {
    console.error('[agent] OpenAI error:', err.message);
    return fallbackAnalysis(person);
  }
}

export async function generateDateDialogue(a, b) {
  if (!process.env.OPENAI_API_KEY) {
    return staticDate(a, b);
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const prompt = `You are writing a SIMULATED agent dating conversation. This is explicit fiction for a demo platform. The agents are AI constructs representing public personas — not real people speaking.

AGENT A represents: ${a.name}
Profile summary: ${a.profile.summary}
Interests: ${(a.profile.interests || []).slice(0, 6).join(', ')}
Hobbies: ${(a.profile.hobbies || []).slice(0, 4).join(', ')}
Needs: ${(a.profile.needs || []).slice(0, 3).join(', ')}
Social style: ${(a.profile.social_style || []).slice(0, 3).join(', ')}

AGENT B represents: ${b.name}
Profile summary: ${b.profile.summary}
Interests: ${(b.profile.interests || []).slice(0, 6).join(', ')}
Hobbies: ${(b.profile.hobbies || []).slice(0, 4).join(', ')}
Needs: ${(b.profile.needs || []).slice(0, 3).join(', ')}
Social style: ${(b.profile.social_style || []).slice(0, 3).join(', ')}

Write a realistic 10-turn simulated agent date dialogue. The agents should:
1. Open with a genuine observation about a shared interest or complementary trait.
2. Explore each other's intellectual and creative passions (not romantic).
3. Propose a specific activity that fits BOTH their public profiles.
4. Each share one inner thought (a private reasoning step — what they're evaluating).
5. Conclude with each agent's independent decision (continue / not continue) with a clear reason.

Format as JSON: { "venue": string, "activity": string, "shared_interest": string, "turns": [{"agent": name, "type": "speak"|"think", "text": string}], "decision_a": {"continue": bool, "reason": string}, "decision_b": {"continue": bool, "reason": string}, "chemistry_score": 0-100, "disclaimer": string }

Make it feel real — specific details, genuine intellectual friction or spark. Not generic.`;

  try {
    const r = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }]
    });
    return JSON.parse(r.choices[0].message.content);
  } catch (err) {
    console.error('[agent] Date generation error:', err.message);
    return staticDate(a, b);
  }
}

function staticDate(a, b) {
  const sharedInterests = (a.profile.interests || []).filter(x =>
    (b.profile.interests || []).map(y => y.toLowerCase()).includes(x.toLowerCase())
  );
  const shared = sharedInterests[0] || a.profile.interests?.[0] || 'technology';
  const place = a.profile.date_ideas?.[0] || 'coffee and a walk';

  return {
    venue: 'Coffee + Discussion',
    activity: place,
    shared_interest: shared,
    turns: [
      { agent: a.name, type: 'speak', text: `I noticed we both have a connection to ${shared}. What draws you to it?` },
      { agent: b.name, type: 'think', text: `Interesting opening — testing if the interest is surface-level or deep.` },
      { agent: b.name, type: 'speak', text: `For me it's about the long-term implications. How do you apply it practically?` },
      { agent: a.name, type: 'think', text: `Good — they're not just dropping buzzwords, they want real application.` },
      { agent: a.name, type: 'speak', text: `Practically: through building things. I'd rather propose ${place} as our activity — creates natural collaboration.` },
      { agent: b.name, type: 'speak', text: `That's actually more interesting than dinner. A shared task reveals more.` },
      { agent: a.name, type: 'speak', text: `Exactly my reasoning. What's one thing you'd want the other person to genuinely care about?` },
      { agent: b.name, type: 'speak', text: `Intellectual honesty. The ability to say "I was wrong" or "I don't know yet".` },
      { agent: a.name, type: 'speak', text: `That's a strong signal. I'd continue this.` },
      { agent: b.name, type: 'speak', text: `Same. The public interest overlap is real, not just surface-level. Continue.` }
    ],
    decision_a: { continue: true, reason: `Strong overlap on ${shared} and complementary communication styles.` },
    decision_b: { continue: true, reason: `Intellectual honesty signals and shared interest in ${shared}.` },
    chemistry_score: 72,
    disclaimer: 'Simulated agent dialogue — not statements made by either real person.'
  };
}

function fallbackAnalysis(person) {
  const raw = `${person.sources.linkedin.text} ${person.sources.instagram.text}`.toLowerCase();
  const tags = {
    ai: ['ai', 'artificial intelligence', 'machine learning', 'llm', 'robotics', 'deep learning'],
    startup: ['startup', 'entrepreneur', 'founder', 'venture', 'business'],
    tech: ['technology', 'software', 'engineering', 'developer', 'product'],
    finance: ['finance', 'investing', 'markets', 'trading', 'fintech'],
    travel: ['travel', 'world', 'trip', 'adventure', 'explore'],
    fitness: ['fitness', 'running', 'marathon', 'gym', 'sport', 'yoga', 'cycling'],
    food: ['food', 'restaurant', 'cooking', 'chef', 'culinary'],
    design: ['design', 'creative', 'art', 'fashion', 'visual'],
    books: ['book', 'reading', 'author', 'literature', 'writing'],
    music: ['music', 'guitar', 'piano', 'concert', 'spotify'],
    climate: ['climate', 'sustainability', 'environment', 'green', 'clean energy'],
  };
  const interests = Object.entries(tags)
    .filter(([, words]) => words.some(w => raw.includes(w)))
    .map(([k]) => k);

  return {
    summary: `Profile extracted from public LinkedIn and Instagram pages. Limited data available.`,
    needs: ['Authentic conversation around shared interests', 'Specific shared activity with room for real exchange'],
    hobbies: [],
    interests: interests.length ? interests : ['technology', 'learning'],
    qualities: ['curious', 'goal-oriented'],
    work_style: ['builder mindset'],
    social_style: ['conversation-led'],
    date_ideas: ['coffee + deep-dive discussion', 'collaborative project or challenge'],
    evidence: ['Inferred from available public source text.']
  };
}
