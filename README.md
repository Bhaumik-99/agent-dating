# Agentic Dating

> **An AI-powered matchmaking platform where every person is represented by an agent. The agents read public LinkedIn + Instagram profiles, then date each other to determine the best matches.**

## Overview

Each person has exactly **two official sources**: their public LinkedIn `/in/` URL and their public Instagram URL. Nothing else. The agent reads only those two pages, produces a grounded profile (needs · hobbies · interests · qualities · work style · social style · date ideas), then conducts simulated agent-to-agent dates with every other agent. Everyone receives a ranked list of their best matches.

## How it works

```
LinkedIn public profile
+
Instagram public profile
        ↓
Agent reads both pages (only those two)
        ↓
Profile page: needs · hobbies · interests · qualities · work style · social style · date ideas
        ↓
Agents date: dynamic multi-turn dialogue, inner thoughts, venue + activity, chemistry score
        ↓
Rankings: every person ranked for every other person, score breakdown
```

## Running locally

```bash
npm install
npx playwright install chromium
cp .env.example .env
# Add your OPENAI_API_KEY to .env
npm start
```

Open `http://localhost:3000`. Click **"Load 25-person demo"** to instantly see all 25 people, profiles, dates, and rankings.

## Building the real demo dataset

```bash
# With OPENAI_API_KEY set in .env:
npm run build:demo
```

This scrapes all 25 real LinkedIn + Instagram public pages via Playwright headless Chromium, then runs GPT-4o-mini analysis on each. Results saved to `data/demo.json`. Takes ~5–10 minutes.

## Technical stack

| Layer | Technology |
|---|---|
| Server | Node.js + Express |
| Scraping | Playwright (headless Chromium), Cheerio |
| Scrape strategy | Headless Chromium with desktop UA, OpenGraph/JSON-LD meta extraction, login-wall fallback |
| AI analysis | OpenAI GPT-4o-mini (structured JSON output) |
| Dating harness | GPT-4o-mini dynamic dialogue — venue, activity, inner thoughts, chemistry score, agent decisions |
| Compatibility | Weighted token overlap (interests 35%, hobbies 20%, needs 15%, work style 12%, social style 10%, qualities 8%) |
| Frontend | Vanilla HTML/CSS/JS — no framework |

## Demo video sequence (≤ 3:00)

- **0:00–0:20** — Homepage + "Load 25-person demo" click
- **0:20–0:45** — Source cards + profile extraction (LinkedIn + Instagram sources visible)
- **0:45–1:10** — Agent profile for one person: needs / hobbies / interests / qualities / evidence
- **1:10–2:10** — Animated agent date for one pair: inner thoughts, venue, activity, chemistry score, dual decision
- **2:10–2:40** — Rankings table: click a person, see all 24 ranked suitors, click one for breakdown modal
- **2:40–3:00** — Live paste: fresh public LinkedIn + Instagram links → new agent profile → added to pool

## Data boundary

The agent dating dialogue is explicitly simulated. It does not claim that the real person said, agreed to, or holds any opinion. Only public profile data is used. No sensitive attributes (sexual orientation, religion, health, political views, race/ethnicity) are ever inferred.

## 25 people

All 25 are real public figures with public LinkedIn `/in/` profiles and public Instagram accounts:

Satya Nadella · Sundar Pichai · Mark Zuckerberg · Brian Chesky · Patrick Collison · Dharmesh Shah · Naval Ravikant · Nikhil Kamath · Kunal Bahl · Anupam Mittal · Namita Thapar · Vineeta Singh · Aman Gupta · Peyush Bansal · Falguni Nayar · Ankur Warikoo · Bhavish Aggarwal · Ritesh Agarwal · Deepinder Goyal · Rajan Anandan · Fei-Fei Li · Andrew Ng · Kevin Systrom · Nithin Kamath · Amit Jain

## Overall explanation (≤ 200 chars)

> AI agents analyze 25 real people via public LinkedIn + Instagram only, simulate multi-turn dates on their behalf, and compute compatibility rankings for every person.

## Hand-ins

- **YouTube video** — 3-min demo showing profile analysis, agents dating, and rankings
- **Demo link** — Live URL with 25-person example pre-loaded
- **Live website** — Paste your own public links and try it
- **GitHub** — Public repo (this one)
