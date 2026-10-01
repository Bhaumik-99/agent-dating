import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import { scrapePublicPage } from './scraper.js';
import { analyzePerson, generateDateDialogue } from './agent.js';
import { rankPeople, compatibility } from './match.js';
import { emptyProfile } from './schema.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const root = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(root, '../public')));

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
    // Return deterministic cached rankings that incorporate the agent dates
    const rankings = DEMO.rankings || rankPeople(DEMO.people, DEMO.sampleDates || {});
    res.json({ people: DEMO.people, rankings, sampleDates: DEMO.sampleDates || {} });
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

    const p = emptyProfile(`live-${Date.now()}`, name, li.url, ig.url);
    p.sources.linkedin = li;
    p.sources.instagram = ig;
    p.profile = await analyzePerson(p);
    console.log(`[analyze] Done: ${name}`);

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
    res.json({ rankings: rankPeople(people) });
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
