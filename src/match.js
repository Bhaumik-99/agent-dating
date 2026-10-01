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

export function compatibility(a, b) {
  const i = matchCategories(a.profile?.interests, b.profile?.interests);
  const h = matchCategories(a.profile?.hobbies, b.profile?.hobbies);
  const w = matchCategories(a.profile?.work_style, b.profile?.work_style);
  const s = matchCategories(a.profile?.social_style, b.profile?.social_style);
  const q = matchCategories(a.profile?.qualities, b.profile?.qualities);
  const n = matchCategories(a.profile?.needs, b.profile?.needs);

  // Normalized dimensional scores (0-100)
  const scoreInterests = Math.min(100, Math.round(i.rawScore * 3.0 + (i.hit.length > 0 ? 35 : 10)));
  const scoreHobbies = Math.min(100, Math.round(h.rawScore * 3.0 + (h.hit.length > 0 ? 30 : 10)));
  const scoreNeeds = Math.min(100, Math.round(n.rawScore * 2.5 + (n.hit.length > 0 ? 30 : 10)));
  const scoreWork = Math.min(100, Math.round(w.rawScore * 2.5 + (w.hit.length > 0 ? 30 : 15)));
  const scoreSocial = Math.min(100, Math.round(s.rawScore * 2.5 + (s.hit.length > 0 ? 25 : 15)));

  // Weighted overall compatibility score
  const totalRaw = (scoreInterests * 0.35) + (scoreHobbies * 0.20) + (scoreNeeds * 0.15) + (scoreWork * 0.15) + (scoreSocial * 0.15);
  const score = Math.round(Math.min(98, Math.max(15, totalRaw)) * 10) / 10;

  // Specific positive reasons
  const positiveReasons = [
    ...i.hit.slice(0, 3).map(x => `Shared interest: ${x}`),
    ...h.hit.slice(0, 2).map(x => `Shared hobby: ${x}`),
    ...n.hit.slice(0, 2).map(x => `Aligned need: ${x}`),
    ...w.hit.slice(0, 2).map(x => `Work style: ${x}`),
  ];

  const breakdown = {
    interests: { score: scoreInterests, shared: i.hit },
    hobbies: { score: scoreHobbies, shared: h.hit },
    needs: { score: scoreNeeds, shared: n.hit },
    work_style: { score: scoreWork, shared: w.hit },
    social_style: { score: scoreSocial, shared: s.hit },
  };

  return { score, reasons: positiveReasons, breakdown };
}

// Filter top candidate pairs for the dating round
export function filterCandidatePairs(people, topK = 6) {
  const pairSet = new Set();
  const pairs = [];

  for (const p of people) {
    const scored = people
      .filter(x => x.id !== p.id)
      .map(x => ({ target: x, comp: compatibility(p, x) }))
      .sort((a, b) => b.comp.score - a.comp.score)
      .slice(0, topK);

    for (const item of scored) {
      const idA = p.id < item.target.id ? p.id : item.target.id;
      const idB = p.id < item.target.id ? item.target.id : p.id;
      const key = `${idA}_${idB}`;
      if (!pairSet.has(key)) {
        pairSet.add(key);
        const personA = people.find(x => x.id === idA);
        const personB = people.find(x => x.id === idB);
        pairs.push([personA, personB]);
      }
    }
  }

  return pairs;
}

export function rankPeople(people, datesMap = {}) {
  return Object.fromEntries(people.map(p => {
    const list = people
      .filter(x => x.id !== p.id)
      .map(x => {
        const key = `${p.id}_${x.id}`;
        const revKey = `${x.id}_${p.id}`;
        const date = datesMap[key] || datesMap[revKey] || null;
        const profileComp = compatibility(p, x);

        let finalScore = profileComp.score;
        let dated = false;
        let mutualContinue = false;

        if (date && typeof date.chemistry_score === 'number') {
          dated = true;
          const chem = date.chemistry_score;
          const aCont = date.decision_a?.continue ?? true;
          const bCont = date.decision_b?.continue ?? true;
          mutualContinue = aCont && bCont;

          // Date evaluation directly influences final compatibility:
          // 40% profile baseline + 45% date chemistry + mutual decision bonus/penalty
          const bonus = (aCont && bCont) ? 12 : (aCont || bCont ? -6 : -18);
          finalScore = Math.round(Math.min(99, Math.max(15, (profileComp.score * 0.40) + (chem * 0.45) + bonus)) * 10) / 10;
        } else {
          // Pairs that didn't qualify for the candidate dating round receive a lower baseline ceiling
          finalScore = Math.round(Math.min(52, profileComp.score * 0.70) * 10) / 10;
        }

        return {
          id: x.id,
          name: x.name,
          score: finalScore,
          profileScore: profileComp.score,
          dated,
          date,
          reasons: profileComp.reasons,
          breakdown: profileComp.breakdown,
          personB: x
        };
      })
      .sort((a, b) => b.score - a.score);

    const total = list.length;
    return [
      p.id,
      list.map((item, idx) => {
        const rank = idx + 1;
        let explanation = '';
        const d = item.date;

        if (item.dated && d) {
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
            explanation = `Ranked #${rank}/${total} · ${item.score}% fit. Dated at ${d.venue} (${d.chemistry_score}/100 chemistry), but did not advance: ${declinedBy} declined ("${decReason}").`;
          }
        } else {
          const aTop = p.profile?.interests?.[0] || 'core domain';
          const bTop = item.personB?.profile?.interests?.[0] || 'primary domain';
          if (rank >= total - 2) {
            explanation = `Lowest Fit (#${rank}/${total}) · ${item.score}%. Filtered out before the dating round due to divergent focus (${aTop} vs ${bTop}) and minimal public overlap.`;
          } else {
            explanation = `Ranked #${rank}/${total} · ${item.score}%. Moderate baseline profile resonance (${item.profileScore}%), but did not qualify for the candidate dating round.`;
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
