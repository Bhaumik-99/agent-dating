/**
 * suite.test.mjs
 * Comprehensive automated test suite for Agentic Dating platform.
 * 
 * Verifies:
 * 1. URL validation & strict source-boundary enforcement (rejects Wikipedia, Twitter, non-in LinkedIn, etc.)
 * 2. Profile extraction (deterministic, grounded evidence, observed vs derived traits)
 * 3. Duplicate removal & data integrity
 * 4. Compatibility calculation incorporating dating outcomes
 * 5. Multi-turn Agent Date generation (turns, venue, chemistry score, speak/think tags)
 * 6. Ranking algorithm incorporating simulated dates
 * 7. 25-person demo completeness
 */

import assert from 'assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateSourceUrls, normalizeUrl, createPerson } from '../src/schema.js';
import { analyzePersonLocally } from '../src/analyzer.js';
import { DatingAgent, simulateAgentDate } from '../src/agent.js';
import { compatibility, rankPeople } from '../src/match.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTests() {
  console.log('=== Running Agentic Dating Test Suite ===\n');
  let passed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(err);
      process.exit(1);
    }
  }

  // 1. URL Validation & Source Boundary Enforcement
  test('URL Validation accepts valid LinkedIn and Instagram URLs', () => {
    assert.doesNotThrow(() => {
      validateSourceUrls('https://www.linkedin.com/in/satyanadella/', 'https://www.instagram.com/satyanadella/');
    });
    assert.doesNotThrow(() => {
      validateSourceUrls('https://linkedin.com/in/zuck', 'https://instagram.com/zuck');
    });
  });

  test('URL Validation strictly rejects unauthorized domains (Wikipedia, Twitter/X, etc.)', () => {
    assert.throws(() => {
      validateSourceUrls('https://en.wikipedia.org/wiki/Satya_Nadella', 'https://instagram.com/satyanadella/');
    }, /Unsupported source domain/);

    assert.throws(() => {
      validateSourceUrls('https://linkedin.com/in/satyanadella/', 'https://twitter.com/satyanadella');
    }, /Unsupported source domain/);

    assert.throws(() => {
      validateSourceUrls('https://crunchbase.com/person/satya-nadella', 'https://instagram.com/satyanadella/');
    }, /Unsupported source domain/);
  });

  test('URL Validation rejects non-profile LinkedIn paths (company, feed, etc.)', () => {
    assert.throws(() => {
      validateSourceUrls('https://linkedin.com/company/microsoft/', 'https://instagram.com/satyanadella/');
    }, /Invalid LinkedIn profile path/);
  });

  test('URL Normalization cleans parameters and anchors', () => {
    const raw = 'https://www.linkedin.com/in/satyanadella/?ref=search#skills';
    const norm = normalizeUrl(raw);
    assert.equal(norm, 'https://www.linkedin.com/in/satyanadella/');
  });

  // 2. Profile Extraction & Evidence Attribution
  test('Local Profile Extraction produces grounded output with source evidence', () => {
    const mockPerson = {
      id: 'p_test',
      name: 'Test Founder',
      linkedin: 'https://www.linkedin.com/in/testfounder/',
      instagram: 'https://www.instagram.com/testfounder/',
      sources: {
        linkedin: {
          url: 'https://www.linkedin.com/in/testfounder/',
          status: 'verified_public',
          text: 'TITLE: CEO & Co-founder at FutureAI | Machine Learning Researcher\nMETA: Building frontier artificial intelligence systems and autonomous agents.\nVISIBLE_TEXT: Building autonomous systems. Long-distance running and marathon finisher.'
        },
        instagram: {
          url: 'https://www.instagram.com/testfounder/',
          status: 'verified_public',
          text: 'META: Test Founder on Instagram: "Founder @ FutureAI. Specialty coffee enthusiast and marathon runner."'
        }
      }
    };

    const profile = analyzePersonLocally(mockPerson);
    assert.ok(profile.summary.length > 10, 'Summary should be generated');
    assert.ok(profile.interests.some(i => i.includes('Artificial Intelligence')), 'Should detect AI interest');
    assert.ok(profile.hobbies.some(h => h.includes('Running')), 'Should detect running hobby');
    assert.ok(profile.evidence.length >= 2, 'Should include evidence snippets');
    assert.ok(profile.evidence.some(e => e.startsWith('[LinkedIn]') || e.startsWith('[Instagram]')), 'Evidence should have source tag');
    assert.ok(profile.observed_facts, 'Must have observed_facts');
    assert.ok(profile.derived_traits, 'Must have derived_traits');
  });

  // 3. Duplicate Removal
  test('Duplicate interests and hobbies are properly deduplicated in profile', () => {
    const mockPerson = {
      id: 'p_dup',
      name: 'Dup Tester',
      linkedin: 'https://www.linkedin.com/in/duptest/',
      instagram: 'https://www.instagram.com/duptest/',
      sources: {
        linkedin: { text: 'artificial intelligence ai machine learning ai deep learning' },
        instagram: { text: 'artificial intelligence running running running marathon' }
      }
    };
    const prof = analyzePersonLocally(mockPerson);
    const uniqueInterests = new Set(prof.interests);
    assert.equal(prof.interests.length, uniqueInterests.size, 'Interests must have no duplicates');
    const uniqueHobbies = new Set(prof.hobbies);
    assert.equal(prof.hobbies.length, uniqueHobbies.size, 'Hobbies must have no duplicates');
  });

  // 4. Agent Dating Architecture
  test('Agent Dating generates dynamic turns, speech, and private thinking', () => {
    const personA = {
      id: 'pA',
      name: 'Alice Agent',
      profile: {
        interests: ['Artificial Intelligence & Machine Learning'],
        hobbies: ['Specialty Coffee'],
        work_style: ['Founder-led execution'],
        date_ideas: ['Pour-over tasting at an independent roastery']
      }
    };
    const personB = {
      id: 'pB',
      name: 'Bob Agent',
      profile: {
        interests: ['Artificial Intelligence & Machine Learning'],
        hobbies: ['Specialty Coffee'],
        work_style: ['Founder-led execution'],
        date_ideas: ['Pour-over tasting at an independent roastery']
      }
    };

    const date = simulateAgentDate(personA, personB);
    assert.equal(date.agent_a, 'Alice Agent');
    assert.equal(date.agent_b, 'Bob Agent');
    assert.ok(date.venue, 'Date must have a venue');
    assert.ok(date.activity, 'Date must have an activity');
    assert.ok(date.turns.length >= 8, 'Date must have at least 8 turns');
    assert.ok(date.turns.some(t => t.type === 'think'), 'Date must contain private thinking turns');
    assert.ok(date.turns.some(t => t.type === 'speak'), 'Date must contain spoken dialogue');
    assert.equal(typeof date.chemistry_score, 'number');
    assert.equal(typeof date.decision_a.continue, 'boolean');
    assert.equal(typeof date.decision_b.continue, 'boolean');
  });

  // 5. Compatibility & Dating-Influenced Ranking
  test('Dating outcome directly affects compatibility score and ranking', () => {
    const p1 = {
      id: 'p1',
      name: 'Person 1',
      profile: {
        interests: ['Artificial Intelligence & Machine Learning'],
        hobbies: ['Long-Distance Running & Marathons'],
        needs: ['High-bandwidth intellectual exchange'],
        work_style: ['Founder-led execution'],
        social_style: ['Direct and unvarnished conversation']
      }
    };

    const p2High = {
      id: 'p2',
      name: 'Person 2 High Fit',
      profile: {
        interests: ['Artificial Intelligence & Machine Learning'],
        hobbies: ['Long-Distance Running & Marathons'],
        needs: ['High-bandwidth intellectual exchange'],
        work_style: ['Founder-led execution'],
        social_style: ['Direct and unvarnished conversation']
      }
    };

    const p3Low = {
      id: 'p3',
      name: 'Person 3 Divergent',
      profile: {
        interests: ['Hospitality & Travel'],
        hobbies: ['Specialty Coffee'],
        needs: ['Authentic connection'],
        work_style: ['Community-oriented mentorship'],
        social_style: ['Subtle and private presence']
      }
    };

    const highComp = compatibility(p1, p2High);
    const lowComp = compatibility(p1, p3Low);

    assert.ok(highComp.score > lowComp.score, 'High synergy pair must score higher than divergent pair');
    assert.ok(highComp.breakdown.date_outcome.chemistry >= lowComp.breakdown.date_outcome.chemistry, 'Date chemistry must reflect compatibility');

    const rankings = rankPeople([p1, p2High, p3Low]);
    const r1 = rankings['p1'];
    assert.equal(r1[0].id, 'p2', 'Person 2 must be ranked #1 for Person 1');
    assert.ok(/date/i.test(r1[0].explanation), 'Explanation must cite date outcome');
  });

  // 6. 25-Person Demo Completeness
  test('25-Person Demo dataset contains at least 25 real people and 300 unique pair dates', async () => {
    const dataDir = path.join(__dirname, '../data');
    const people = JSON.parse(await fs.readFile(path.join(dataDir, 'people.json'), 'utf8'));
    const dates = JSON.parse(await fs.readFile(path.join(dataDir, 'dates.json'), 'utf8'));
    const rankings = JSON.parse(await fs.readFile(path.join(dataDir, 'rankings.json'), 'utf8'));

    assert.ok(people.length >= 25, `Expected >= 25 people, got ${people.length}`);
    const expectedPairs = (people.length * (people.length - 1)) / 2;
    assert.ok(Object.keys(dates).length >= expectedPairs, `Expected >= ${expectedPairs} dates, got ${Object.keys(dates).length}`);
    assert.ok(Object.keys(rankings).length >= 25, `Expected rankings for all people`);
  });

  console.log(`\n========================================`);
  console.log(`✓ ALL ${passed} AUTOMATED TESTS PASSED SUCCESSFULLY`);
  console.log(`========================================\n`);
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
