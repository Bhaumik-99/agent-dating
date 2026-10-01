/**
 * match.js
 * Multi-factor Compatibility & Ranking Engine.
 * 
 * Architecture:
 * LinkedIn + Instagram 
 *       ↓
 * Profile extraction 
 *       ↓ 
 * Agent representation 
 *       ↓ 
 * Agent-to-agent date 
 *       ↓ 
 * Date evaluation 
 *       ↓ 
 * Compatibility 
 *       ↓ 
 * Ranking
 * 
 * Combines:
 * - Interests (25%)
 * - Hobbies (15%)
 * - Needs (15%)
 * - Work & Lifestyle (15%)
 * - Social & Conversation Style (10%)
 * - Date Proposal Compatibility (5%)
 * - Simulated Date Outcome (15%)
 */

import { simulateAgentDate } from './agent.js';

const STOP_WORDS = new Set([
  'and','the','to','of','in','a','an','for','with','on','at','from','by','about',
  'as','into','through','over','after','how','what','why','gets','done','based',
  'that','this','their','them','they','been','have','having','like','more','also',
  'which','when','were','where','each','both','such','only','than'
]);

function extractTokens(arr) {
  const tokens = new Set();
  const rawPhrases = (arr || []).filter(Boolean);
  for (const item of rawPhrases) {
    const clean = String(item).toLowerCase().trim();
    if (clean) tokens.add(clean);
    const words = clean.split(/[^a-z0-9+#]+/);
    for (const w of words) {
      if (w.length >= 2 && !STOP_WORDS.has(w)) {
        tokens.add(w);
      }
    }
  }
  return { tokens, phrases: rawPhrases };
}

function matchCategories(listA = [], listB = []) {
  const A = extractTokens(listA);
  const B = extractTokens(listB);

  const sharedPhrases = [];
  const sharedTokens = new Set();

  for (const pa of A.phrases) {
    const la = pa.toLowerCase();
    for (const pb of B.phrases) {
      const lb = pb.toLowerCase();
      if (la === lb || (la.length > 4 && lb.length > 4 && (la.includes(lb) || lb.includes(la)))) {
        sharedPhrases.push(la.length < lb.length ? pa : pb);
      }
    }
  }

  for (const t of A.tokens) {
    if (B.tokens.has(t)) {
      sharedTokens.add(t);
    }
  }

  const uniqueShared = Array.from(new Set([...sharedPhrases, ...sharedTokens]));
  const baseSize = Math.max(1, Math.min(A.tokens.size, B.tokens.size));
  const rawRatio = sharedTokens.size / baseSize;
  const rawScore = Math.min(100, Math.round(rawRatio * 100));

  return {
    rawScore,
    hit: uniqueShared.slice(0, 5)
  };
}

/**
 * Computes multi-dimensional compatibility incorporating the simulated agent date.
 */
export function compatibility(personA, personB, existingDate = null) {
  const i = matchCategories(personA.profile?.interests, personB.profile?.interests);
  const h = matchCategories(personA.profile?.hobbies, personB.profile?.hobbies);
  const w = matchCategories(personA.profile?.work_style, personB.profile?.work_style);
  const s = matchCategories(personA.profile?.social_style, personB.profile?.social_style);
  const n = matchCategories(personA.profile?.needs, personB.profile?.needs);

  // 1. Dimensional scores (0-100)
  const scoreInterests = Math.min(100, Math.round(i.rawScore * 2.8 + (i.hit.length > 0 ? 35 : 10)));
  const scoreHobbies = Math.min(100, Math.round(h.rawScore * 2.8 + (h.hit.length > 0 ? 30 : 10)));
  const scoreNeeds = Math.min(100, Math.round(n.rawScore * 2.5 + (n.hit.length > 0 ? 30 : 10)));
  const scoreWork = Math.min(100, Math.round(w.rawScore * 2.5 + (w.hit.length > 0 ? 30 : 15)));
  const scoreSocial = Math.min(100, Math.round(s.rawScore * 2.5 + (s.hit.length > 0 ? 25 : 15)));

  // 2. Simulated agent date execution or lookup
  const date = existingDate || simulateAgentDate(personA, personB);

  // 3. Date proposal & outcome evaluations
  const proposalScore = Math.min(100, 60 + (i.hit.length > 0 ? 20 : 0) + (h.hit.length > 0 ? 20 : 0));
  const dateChemistry = date.chemistry_score || 50;
  const decisionA = date.decision_a?.continue ?? true;
  const decisionB = date.decision_b?.continue ?? true;
  const mutualContinue = decisionA && decisionB;
  const decisionBonus = mutualContinue ? 8 : (decisionA || decisionB ? -4 : -12);

  // 4. Weighted transparent score calculation:
  // Interests 25%, Hobbies 15%, Needs 15%, Work/Lifestyle 15%, Social 10%, Proposal 5%, Date Outcome 15%
  const weighted = 
    (scoreInterests * 0.25) +
    (scoreHobbies * 0.15) +
    (scoreNeeds * 0.15) +
    (scoreWork * 0.15) +
    (scoreSocial * 0.10) +
    (proposalScore * 0.05) +
    (dateChemistry * 0.15);

  const finalScore = Math.round(Math.min(99, Math.max(15, weighted + decisionBonus)) * 10) / 10;

  // 5. Reasons compilation
  const reasons = [
    ...i.hit.slice(0, 2).map(x => `Shared interest: ${x}`),
    ...h.hit.slice(0, 1).map(x => `Shared hobby: ${x}`),
    ...n.hit.slice(0, 1).map(x => `Aligned need: ${x}`),
    ...w.hit.slice(0, 1).map(x => `Work style: ${x}`),
    `Date outcome: ${dateChemistry}/100 chemistry (${mutualContinue ? 'Mutual 2nd date' : 'Single/mixed decision'})`
  ];

  const breakdown = {
    interests: { score: scoreInterests, shared: i.hit },
    hobbies: { score: scoreHobbies, shared: h.hit },
    needs: { score: scoreNeeds, shared: n.hit },
    work_lifestyle: { score: scoreWork, shared: w.hit },
    social_style: { score: scoreSocial, shared: s.hit },
    date_proposal: { score: proposalScore, venue: date.venue, activity: date.activity },
    date_outcome: { score: dateChemistry, chemistry: dateChemistry, decision_a: date.decision_a, decision_b: date.decision_b }
  };

  return {
    score: finalScore,
    reasons,
    breakdown,
    date
  };
}

/**
 * Computes rankings for every person incorporating simulated dates.
 */
export function rankPeople(people, datesMap = {}) {
  return Object.fromEntries(people.map(p => {
    const list = people
      .filter(x => x.id !== p.id)
      .map(x => {
        const key = `${p.id}_${x.id}`;
        const revKey = `${x.id}_${p.id}`;
        const date = datesMap[key] || datesMap[revKey] || simulateAgentDate(p, x);
        const comp = compatibility(p, x, date);

        return {
          id: x.id,
          name: x.name,
          score: comp.score,
          reasons: comp.reasons,
          breakdown: comp.breakdown,
          date,
          personB: x
        };
      })
      .sort((a, b) => b.score - a.score);

    const total = list.length;
    return [
      p.id,
      list.map((item, idx) => {
        const rank = idx + 1;
        const d = item.date;
        let explanation = '';

        const aReason = d.decision_a?.reason || 'Aligned conversational pace';
        const bReason = d.decision_b?.reason || 'Shared professional vision';

        if (d.decision_a?.continue && d.decision_b?.continue) {
          if (rank === 1) {
            explanation = `Top Match (#1/${total}) · ${item.score}% fit. Outstanding date chemistry (${d.chemistry_score}/100) at ${d.venue}. Both agents mutually decided to continue. ${p.name}: "${aReason}". ${item.name}: "${bReason}".`;
          } else {
            explanation = `Ranked #${rank}/${total} · ${item.score}% fit. High date chemistry (${d.chemistry_score}/100) discussing ${d.shared_interest || 'shared interests'}. Both agents agreed on a 2nd date.`;
          }
        } else {
          const declinedBy = !d.decision_a?.continue ? p.name : item.name;
          const decReason = !d.decision_a?.continue ? aReason : bReason;
          if (rank >= total - 2) {
            explanation = `Lowest Fit (#${rank}/${total}) · ${item.score}%. Date at ${d.venue} revealed divergent operating priorities (${item.personB.profile?.interests?.[0] || 'domain'}). ${declinedBy} declined: "${decReason}".`;
          } else {
            explanation = `Ranked #${rank}/${total} · ${item.score}% fit. Dated at ${d.venue} (${d.chemistry_score}/100 chemistry), but did not advance: ${declinedBy} declined ("${decReason}").`;
          }
        }

        const { personB, ...cleanItem } = item;
        return {
          ...cleanItem,
          rank,
          explanation
        };
      })
    ];
  }));
}
