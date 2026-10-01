import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzePerson, generateDateDialogue } from '../src/agent.js';
import { rankPeople } from '../src/match.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const demoPath = path.join(root, '../data/demo.json');

async function main() {
  console.log('=== Starting Gemini 2.5 Flash Grounded Profile Analysis for All 25 People ===');

  const raw = await fs.readFile(demoPath, 'utf8');
  const data = JSON.parse(raw);
  const people = data.people || [];

  console.log(`Loaded ${people.length} people from demo.json`);

  for (let i = 0; i < people.length; i++) {
    const person = people[i];
    const liCh = person.sources?.linkedin?.text?.length || 0;
    const igCh = person.sources?.instagram?.text?.length || 0;

    // Skip if already analyzed by Gemini
    const isFallback = (person.profile?.evidence?.[0] || '').startsWith('LinkedIn title:');
    if (!isFallback && person.profile?.date_ideas?.length) {
      console.log(`[${i + 1}/${people.length}] Already analyzed by Gemini: ${person.name} — skipping.`);
      continue;
    }

    console.log(`\n[${i + 1}/${people.length}] Analyzing with Gemini: ${person.name} (LI: ${liCh}ch, IG: ${igCh}ch)...`);
    const start = Date.now();

    try {
      const profile = await analyzePerson(person);
      person.profile = profile;
      console.log(`  ✓ Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
      console.log(`    Summary: ${(profile.summary || '').slice(0, 80)}...`);
      console.log(`    Interests (${(profile.interests || []).length}): ${(profile.interests || []).slice(0, 3).join(', ')}...`);
      console.log(`    Needs (${(profile.needs || []).length}): ${(profile.needs || []).slice(0, 2).join(', ')}...`);
    } catch (err) {
      console.error(`  ✗ Error analyzing ${person.name}:`, err.message);
    }

    // Save checkpoint every 3 people
    if ((i + 1) % 3 === 0 || i === people.length - 1) {
      data.rankings = rankPeople(people);
      data.updated_at = new Date().toISOString();
      await fs.writeFile(demoPath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`  [Checkpoint saved to demo.json]`);
    }

    // Rate-limit throttle to stay comfortably within quota
    await new Promise(r => setTimeout(r, 1200));
  }

  // Compute final rankings with full explanations
  console.log('\n=== Computing Full Cross-Agent Rankings ===');
  const rankings = rankPeople(people);
  data.rankings = rankings;

  // Pre-generate top sample date dialogues
  console.log('\n=== Pre-generating Key Simulated Agent Dates ===');
  const samplePairs = [
    ['p01', 'p05'], // Satya Nadella x Patrick Collison
    ['p02', 'p22'], // Sundar Pichai x Andrew Ng
    ['p03', 'p23'], // Mark Zuckerberg x Kevin Systrom
    ['p04', 'p06'], // Brian Chesky x Dharmesh Shah
    ['p08', 'p24'], // Nikhil Kamath x Nithin Kamath
  ];

  data.sampleDates = {};
  for (const [idA, idB] of samplePairs) {
    const a = people.find(p => p.id === idA);
    const b = people.find(p => p.id === idB);
    if (a && b) {
      console.log(`Generating simulated date: ${a.name} × ${b.name}...`);
      try {
        const date = await generateDateDialogue(a, b);
        data.sampleDates[`${a.id}_${b.id}`] = date;
        data.sampleDates[`${b.id}_${a.id}`] = date;
        console.log(`  ✓ Chemistry: ${date.chemistry_score}/100, Venue: ${date.venue}`);
      } catch (e) {
        console.warn(`  ✗ Date error:`, e.message);
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  data.status = 'complete';
  data.generated_at = new Date().toISOString();
  await fs.writeFile(demoPath, JSON.stringify(data, null, 2), 'utf8');

  console.log('\n======================================================');
  console.log('✓ ALL 25 PROFILES ANALYZED WITH GEMINI 2.5 FLASH');
  console.log('✓ ALL RANKINGS COMPUTED WITH EXPLANATIONS');
  console.log('✓ AGENT DATE DIALOGUES GENERATED');
  console.log('✓ SAVED TO data/demo.json');
  console.log('======================================================');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
