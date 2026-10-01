# Agentic Dating Site

A demo-ready agentic matchmaking site built around one hard rule: **every person has exactly two information sources** — their public LinkedIn URL and their public Instagram URL.

## Flow

1. Paste/import 25 people.
2. The server validates the two URLs.
3. Each person gets an agent profile extracted only from those two pages.
4. The agent produces `needs`, `hobbies`, `interests`, `work style`, `social style`, and `date ideas`.
5. Every agent conducts a simulated agent-to-agent date with a small dialogue and a proposed activity.
6. Compatibility is computed symmetrically from the agent profiles.
7. Every person gets a full ranking of the other 24 people.

## Run locally

```bash
npm install
npx playwright install chromium
cp .env.example .env
# add OPENAI_API_KEY
npm start
```

Open `http://localhost:3000`.

## Demo mode

The landing page loads the precomputed 25-person example from `data/demo.json`, so the evaluator can click through without pasting URLs. The live form accepts new public LinkedIn + Instagram pairs.

## Scraping strategy

- First attempt: Playwright on the supplied public profile URL.
- Parse title, meta description, JSON-LD, and visible profile text.
- Never search by the person's name during analysis.
- Never use a third source in the agent prompt.
- Optional deployment fallback: Apify actor endpoints can be enabled with environment variables.

## Important data-use boundary

The app treats the dating conversation as a **simulation**. It does not claim that a real person said anything, agreed to date, or has any romantic preference unless that information is explicitly present on the supplied public profiles. Agent outputs describe public-interest compatibility only.

## Demo video sequence (<= 3:00)

- 0:00–0:20: homepage + paste/import two links.
- 0:20–0:45: source cards + extraction.
- 0:45–1:05: generated profile (needs/hobbies/interests/qualities).
- 1:05–2:10: animated agent date for one pair: intro → shared interests → date plan → decision.
- 2:10–2:45: rankings table, click two profiles, show score breakdown.
- 2:45–3:00: live paste of a fresh public pair + final explanation.

## Technical stack

Node.js, Express, Playwright, Cheerio, OpenAI API, vanilla HTML/CSS/JS. Optional Apify for hosted scraping reliability.
