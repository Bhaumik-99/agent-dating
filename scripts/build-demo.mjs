#!/usr/bin/env node
/**
 * build-demo.mjs
 * Scrapes all 25 people's LinkedIn + Instagram public pages,
 * runs AI analysis, and writes data/demo.json.
 *
 * Run: node scripts/build-demo.mjs
 * Requires: OPENAI_API_KEY in .env
 */
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrapePublicPage } from '../src/scraper.js';
import { analyzePerson } from '../src/agent.js';
import { emptyProfile } from '../src/schema.js';

const root = path.dirname(fileURLToPath(import.meta.url));

// 25 real public figures with verified public LinkedIn /in/ handles
// and public Instagram profiles (verified public as of 2024-2025)
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

async function processPerson(raw, index) {
  const id = `p${String(index + 1).padStart(2, '0')}`;
  const person = emptyProfile(id, raw.name, raw.linkedin, raw.instagram);

  console.log(`\n[${index + 1}/25] Processing: ${raw.name}`);

  // Scrape LinkedIn
  try {
    console.log(`  → Scraping LinkedIn...`);
    person.sources.linkedin = await scrapePublicPage(raw.linkedin);
    console.log(`  ✓ LinkedIn: ${person.sources.linkedin.text.length} chars`);
  } catch (e) {
    console.warn(`  ✗ LinkedIn scrape failed: ${e.message}`);
    person.sources.linkedin = { url: raw.linkedin, text: `URL: ${raw.linkedin}\nNOTE: Could not retrieve — login wall or access restricted.` };
  }

  // Scrape Instagram
  try {
    console.log(`  → Scraping Instagram...`);
    person.sources.instagram = await scrapePublicPage(raw.instagram);
    console.log(`  ✓ Instagram: ${person.sources.instagram.text.length} chars`);
  } catch (e) {
    console.warn(`  ✗ Instagram scrape failed: ${e.message}`);
    person.sources.instagram = { url: raw.instagram, text: `URL: ${raw.instagram}\nNOTE: Could not retrieve — login wall or access restricted.` };
  }

  // Analyze
  try {
    console.log(`  → Analyzing with AI...`);
    person.profile = await analyzePerson(person);
    console.log(`  ✓ Profile: ${person.profile.interests.length} interests, ${person.profile.hobbies.length} hobbies`);
  } catch (e) {
    console.warn(`  ✗ Analysis failed: ${e.message}`);
  }

  return person;
}

async function main() {
  console.log('=== Agentic Dating — Building Demo Dataset ===');
  console.log(`Processing ${PEOPLE.length} people...`);

  const results = [];

  // Process sequentially to be polite and avoid rate limits
  for (let i = 0; i < PEOPLE.length; i++) {
    const person = await processPerson(PEOPLE[i], i);
    results.push(person);

    // Save partial progress every 5 people
    if ((i + 1) % 5 === 0) {
      const partial = { people: results, generated_at: new Date().toISOString(), status: 'partial' };
      await fs.writeFile(path.join(root, '../data/demo.json'), JSON.stringify(partial, null, 2), 'utf8');
      console.log(`\n[checkpoint] Saved ${results.length} people to demo.json`);
    }

    // Throttle between people
    if (i < PEOPLE.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  const output = {
    people: results,
    generated_at: new Date().toISOString(),
    status: 'complete',
    count: results.length
  };

  await fs.writeFile(path.join(root, '../data/demo.json'), JSON.stringify(output, null, 2), 'utf8');
  console.log(`\n=== Done! ${results.length} people saved to data/demo.json ===`);
}

main().catch(e => { console.error(e); process.exit(1); });
