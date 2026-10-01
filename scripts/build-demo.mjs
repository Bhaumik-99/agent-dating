#!/usr/bin/env node
/**
 * build-demo.mjs — Full pipeline
 * 
 * Scrapes all 25 people's LinkedIn + Instagram public pages via Playwright,
 * runs GPT-4o-mini analysis on the extracted text, writes data/demo.json.
 * 
 * Requires: OPENAI_API_KEY in .env
 * Run: npm run build:demo
 */
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrapePublicPage } from '../src/scraper.js';
import { analyzePerson } from '../src/agent.js';
import { emptyProfile } from '../src/schema.js';

const root = path.dirname(fileURLToPath(import.meta.url));

// 25 real public figures — verified public LinkedIn /in/ + public Instagram
const PEOPLE = [
  { name: 'Satya Nadella',       linkedin: 'https://www.linkedin.com/in/satyanadella/',           instagram: 'https://www.instagram.com/satyanadella/' },
  { name: 'Sundar Pichai',       linkedin: 'https://www.linkedin.com/in/sundarpichai/',           instagram: 'https://www.instagram.com/sundarpichai/' },
  { name: 'Mark Zuckerberg',     linkedin: 'https://www.linkedin.com/in/zuck/',                   instagram: 'https://www.instagram.com/zuck/' },
  { name: 'Brian Chesky',        linkedin: 'https://www.linkedin.com/in/bchesky/',                instagram: 'https://www.instagram.com/bchesky/' },
  { name: 'Patrick Collison',    linkedin: 'https://www.linkedin.com/in/patrickcollison/',        instagram: 'https://www.instagram.com/patrickc/' },
  { name: 'Dharmesh Shah',       linkedin: 'https://www.linkedin.com/in/dharmesh/',               instagram: 'https://www.instagram.com/dharmesh/' },
  { name: 'Naval Ravikant',      linkedin: 'https://www.linkedin.com/in/naval/',                  instagram: 'https://www.instagram.com/naval/' },
  { name: 'Nikhil Kamath',       linkedin: 'https://www.linkedin.com/in/nikhilkamathcio/',        instagram: 'https://www.instagram.com/nikhilkamathcio/' },
  { name: 'Kunal Bahl',          linkedin: 'https://www.linkedin.com/in/kunalbahl/',               instagram: 'https://www.instagram.com/kunalbahl/' },
  { name: 'Anupam Mittal',       linkedin: 'https://www.linkedin.com/in/anupammittal007/',        instagram: 'https://www.instagram.com/anupammittal/' },
  { name: 'Namita Thapar',       linkedin: 'https://www.linkedin.com/in/namita-thapar/',          instagram: 'https://www.instagram.com/namitathapar/' },
  { name: 'Vineeta Singh',       linkedin: 'https://www.linkedin.com/in/vineetasingh/',           instagram: 'https://www.instagram.com/vineetasng/' },
  { name: 'Aman Gupta',          linkedin: 'https://www.linkedin.com/in/aman-gupta-7217a515/',    instagram: 'https://www.instagram.com/boatxaman/' },
  { name: 'Peyush Bansal',       linkedin: 'https://www.linkedin.com/in/peyushbansal/',           instagram: 'https://www.instagram.com/peyushbansal/' },
  { name: 'Falguni Nayar',       linkedin: 'https://www.linkedin.com/in/falguni-nayar-845065a0/',instagram: 'https://www.instagram.com/falguninayar/' },
  { name: 'Ankur Warikoo',       linkedin: 'https://www.linkedin.com/in/warikoo/',                instagram: 'https://www.instagram.com/ankurwarikoo/' },
  { name: 'Bhavish Aggarwal',    linkedin: 'https://www.linkedin.com/in/bhavishaggarwal/',        instagram: 'https://www.instagram.com/bhavishaggarwal/' },
  { name: 'Ritesh Agarwal',      linkedin: 'https://www.linkedin.com/in/riteshagar/',              instagram: 'https://www.instagram.com/riteshagar/' },
  { name: 'Deepinder Goyal',     linkedin: 'https://www.linkedin.com/in/deepigoyal/',             instagram: 'https://www.instagram.com/deepigoyal/' },
  { name: 'Rajan Anandan',       linkedin: 'https://www.linkedin.com/in/rajan-anandan-2481b814/', instagram: 'https://www.instagram.com/rajan_anandan/' },
  { name: 'Fei-Fei Li',          linkedin: 'https://www.linkedin.com/in/feifeili/',               instagram: 'https://www.instagram.com/drfeifei/' },
  { name: 'Andrew Ng',           linkedin: 'https://www.linkedin.com/in/andrewyng/',              instagram: 'https://www.instagram.com/andrewyng/' },
  { name: 'Kevin Systrom',       linkedin: 'https://www.linkedin.com/in/kevin/',                  instagram: 'https://www.instagram.com/kevin/' },
  { name: 'Nithin Kamath',       linkedin: 'https://www.linkedin.com/in/nithin-kamath-81136242/', instagram: 'https://www.instagram.com/nithinkamath/' },
  { name: 'Amit Jain',           linkedin: 'https://www.linkedin.com/in/cardekhoamitjain/',       instagram: 'https://www.instagram.com/cardekhoamitjain/' },
];

async function scrapeWithRetry(url, maxRetries = 2) {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await scrapePublicPage(url);
    } catch (e) {
      if (i === maxRetries) throw e;
      console.warn(`  ↻ Retry ${i + 1} for ${url}: ${e.message}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

async function processPerson(raw, index) {
  const id = `p${String(index + 1).padStart(2, '0')}`;
  const person = emptyProfile(id, raw.name, raw.linkedin, raw.instagram);

  console.log(`\n[${index + 1}/25] ${raw.name}`);

  // Scrape LinkedIn
  try {
    process.stdout.write(`  → LinkedIn...`);
    person.sources.linkedin = await scrapeWithRetry(raw.linkedin);
    console.log(` ✓ ${person.sources.linkedin.text.length} chars`);
  } catch (e) {
    console.log(` ✗ ${e.message.slice(0, 60)}`);
    person.sources.linkedin = {
      url: raw.linkedin,
      text: `URL: ${raw.linkedin}\nNOTE: Public page limited — login required for full profile.`
    };
  }

  // Scrape Instagram
  try {
    process.stdout.write(`  → Instagram...`);
    person.sources.instagram = await scrapeWithRetry(raw.instagram);
    console.log(` ✓ ${person.sources.instagram.text.length} chars`);
  } catch (e) {
    console.log(` ✗ ${e.message.slice(0, 60)}`);
    person.sources.instagram = {
      url: raw.instagram,
      text: `URL: ${raw.instagram}\nNOTE: Public page limited — login required for full content.`
    };
  }

  // Analyze with AI (or fallback)
  try {
    process.stdout.write(`  → AI analysis...`);
    person.profile = await analyzePerson(person);
    console.log(` ✓ ${person.profile.interests.length} interests, ${person.profile.hobbies.length} hobbies`);
  } catch (e) {
    console.log(` ✗ ${e.message.slice(0, 60)}`);
  }

  return person;
}

async function main() {
  console.log('=== Agentic Dating — Building Real Demo Dataset ===');
  if (!process.env.OPENAI_API_KEY) {
    console.warn('WARNING: No OPENAI_API_KEY set — will use fallback keyword analysis.');
  }

  const results = [];
  for (let i = 0; i < PEOPLE.length; i++) {
    const person = await processPerson(PEOPLE[i], i);
    results.push(person);

    // Save checkpoint every 5 people
    if ((i + 1) % 5 === 0 || i === PEOPLE.length - 1) {
      const out = {
        people: results,
        generated_at: new Date().toISOString(),
        status: i === PEOPLE.length - 1 ? 'complete' : 'partial',
        count: results.length
      };
      await fs.writeFile(
        path.join(root, '../data/demo.json'),
        JSON.stringify(out, null, 2), 'utf8'
      );
      console.log(`\n  [saved ${results.length} people to data/demo.json]`);
    }

    // Throttle between requests
    if (i < PEOPLE.length - 1) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  console.log(`\n=== Done! ${results.length}/25 people saved. ===`);
  console.log('Run: npm start  →  http://localhost:3000');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
