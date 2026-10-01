import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import { scrapePublicPage } from './scraper.js';
import { analyzePerson, generateDateDialogue } from './agent.js';
import { rankPeople, compatibility } from './match.js';
import { createPerson } from './schema.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const root = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(root, '../public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// Load demo data
let DEMO = null;
try {
  DEMO = JSON.parse(await fs.readFile(path.join(root, '../data/demo.json'), 'utf8'));
  console.log(`[server] Demo loaded: ${DEMO.people?.length || 0} people`);
} catch (e) {
  console.warn('[server] No demo.json found — live-only mode');
  DEMO = { people: [] };
}

// GET /api/demo — returns precomputed 25-person dataset with rankings
app.get('/api/demo', async (req, res) => {
  try {
    if (!DEMO || !DEMO.people?.length) {
      return res.status(404).json({ error: 'No demo data available.' });
    }
    const dates = DEMO.dates || DEMO.sampleDates || {};
    // Return deterministic cached rankings that incorporate the agent dates
    const rankings = DEMO.rankings || rankPeople(DEMO.people, dates);
    res.json({ people: DEMO.people, rankings, dates, sampleDates: dates });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/analyze — scrape + analyze a new person live
app.post('/api/analyze', async (req, res) => {
  try {
    const { name, linkedin, instagram } = req.body || {};
    if (!name || !linkedin || !instagram)
      return res.status(400).json({ error: 'name, linkedin, and instagram are required.' });
    if (!/linkedin\.com\/in\//i.test(linkedin))
      return res.status(400).json({ error: 'LinkedIn must be a public /in/ profile URL.' });
    if (!/instagram\.com\//i.test(instagram))
      return res.status(400).json({ error: 'Instagram must be a public profile URL.' });

    console.log(`[analyze] Starting: ${name}`);
    const [li, ig] = await Promise.all([
      scrapePublicPage(linkedin),
      scrapePublicPage(instagram)
    ]);
    console.log(`[analyze] Scraped. LinkedIn: ${li.text.length}ch, Instagram: ${ig.text.length}ch`);

    let cleanName = String(name || '').trim();
    const isInvalidName = !cleanName ||
      /grounded in public evidence/i.test(cleanName) ||
      /evaluated through dialogue/i.test(cleanName) ||
      /protocol specification/i.test(cleanName) ||
      cleanName.length > 60;

    if (isInvalidName) {
      const slugMatch = linkedin.match(/\/in\/([a-zA-Z0-9_-]+)/);
      if (slugMatch && slugMatch[1]) {
        cleanName = slugMatch[1].replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
      } else {
        const titleMatch = (li.text || '').match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
        cleanName = titleMatch ? titleMatch[1].trim() : 'Verified Candidate';
      }
    }

    const p = createPerson(`live-${Date.now()}`, cleanName, li.url, ig.url);
    p.sources.linkedin = li;
    p.sources.instagram = ig;
    p.profile = await analyzePerson(p);

    const rawHeadline = p.profile?.observed_facts?.headline || '';
    const cleanRole = rawHeadline
      .replace(/^title:\s*/i, '')
      .replace(/\|.*$/i, '')
      .replace(/–.*$/i, '')
      .replace(new RegExp(`^${cleanName}\\s*[-–—:]*\\s*`, 'i'), '')
      .trim();
    p.verified_role = cleanRole || 'Verified Candidate';

    console.log(`[analyze] Done: ${cleanName} (${p.verified_role})`);

    res.json(p);
  } catch (e) {
    console.error('[analyze] Error:', e.message);
    res.status(500).json({ error: e.message || 'Analysis failed.' });
  }
});

// POST /api/rank — rank a set of analyzed people
app.post('/api/rank', async (req, res) => {
  try {
    const { people } = req.body || {};
    if (!Array.isArray(people) || people.length < 2)
      return res.status(400).json({ error: 'At least 2 analyzed people are required.' });

    // Deduplicate candidate array on server by ID, normalized name, LinkedIn slug, and Instagram slug
    const seenIds = new Set();
    const seenNames = new Set();
    const seenLiSlugs = new Set();
    const seenIgSlugs = new Set();
    const cleanPeople = [];

    for (const p of people) {
      if (!p || !p.name) continue;
      const id = String(p.id || '');
      const nameKey = (p.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const liSlug = (p.linkedin || '').match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1]?.toLowerCase().replace(/[-_.]/g, '') || '';
      const igSlug = (p.instagram || '').match(/instagram\.com\/([^/?#]+)/i)?.[1]?.toLowerCase().replace(/[-_.]/g, '') || '';

      if (seenIds.has(id) ||
          (nameKey && seenNames.has(nameKey)) ||
          (liSlug && seenLiSlugs.has(liSlug)) ||
          (igSlug && seenIgSlugs.has(igSlug))) {
        continue;
      }

      seenIds.add(id);
      if (nameKey) seenNames.add(nameKey);
      if (liSlug) seenLiSlugs.add(liSlug);
      if (igSlug) seenIgSlugs.add(igSlug);
      cleanPeople.push(p);
    }

    if (cleanPeople.length < 2) {
      return res.status(400).json({ error: 'At least 2 unique candidates are required for ranking.' });
    }

    res.json({ rankings: rankPeople(cleanPeople) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/date — simulate a date between two agents
app.post('/api/date', async (req, res) => {
  try {
    const { a, b } = req.body || {};
    if (!a || !b) return res.status(400).json({ error: 'a and b are required.' });
    const dateData = await generateDateDialogue(a, b);
    res.json({ date: dateData });
  } catch (e) {
    console.error('[date] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/compatibility — get detailed compatibility between two people
app.post('/api/compatibility', async (req, res) => {
  try {
    const { a, b } = req.body || {};
    if (!a || !b) return res.status(400).json({ error: 'a and b are required.' });
    res.json(compatibility(a, b));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('*', (req, res) => res.sendFile(path.join(root, '../public/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Agentic Dating running on http://localhost:${PORT}`));
