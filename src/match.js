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

export function rankPeople(people) {
  return Object.fromEntries(people.map(p => {
    const list = people
      .filter(x => x.id !== p.id)
      .map(x => ({ id: x.id, name: x.name, ...compatibility(p, x), personB: x }))
      .sort((a, b) => b.score - a.score);

    const total = list.length;
    return [
      p.id,
      list.map((item, idx) => {
        const rank = idx + 1;
        let explanation = '';
        const sharedTopics = item.reasons.length ? item.reasons.join(', ') : 'no direct public overlap';
        const aTopInterest = p.profile?.interests?.[0] || 'tech leadership';
        const bTopInterest = item.personB?.profile?.interests?.[0] || 'entrepreneurship';

        if (rank === 1) {
          explanation = `Top match (#1/${total}) with ${item.score}% fit. Highest resonance: ${sharedTopics}. Both agents prioritize complementary pace and focus.`;
        } else if (rank <= 3) {
          explanation = `High tier match (#${rank}/${total}) with ${item.score}% fit. Notable synergy in ${sharedTopics}.`;
        } else if (rank >= total - 1) {
          explanation = `Lowest fit (#${rank}/${total}) with ${item.score}% fit. Divergent focus (${aTopInterest} vs ${bTopInterest}) and minimal shared hobbies or needs from public sources.`;
        } else {
          explanation = `Moderate fit (#${rank}/${total}) with ${item.score}% fit. ${item.reasons.length ? `Aligns partially on ${sharedTopics}.` : `Limited common ground in public profiles.`}`;
        }

        // Clean up internal helper
        const { personB, ...cleanItem } = item;
        return {
          ...cleanItem,
          rank,
          explanation,
        };
      })
    ];
  }));
}
