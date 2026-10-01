const TOK = s => new Set((s || []).map(x => x.toLowerCase().trim()).filter(Boolean));

const overlap = (a, b) => {
  const A = TOK(a), B = TOK(b);
  const hit = [...A].filter(x => B.has(x));
  return { hit, score: A.size ? hit.length / A.size : 0 };
};

// Weighted token overlap + partial match bonus
function partialMatch(a, b) {
  const A = TOK(a), B = TOK(b);
  let partial = 0;
  for (const ta of A) {
    for (const tb of B) {
      if (ta !== tb && (ta.includes(tb) || tb.includes(ta)) && Math.min(ta.length, tb.length) > 3) {
        partial += 0.5;
      }
    }
  }
  const hit = [...A].filter(x => B.has(x));
  const score = A.size ? (hit.length + partial) / A.size : 0;
  return { hit, score: Math.min(1, score) };
}

export function compatibility(a, b) {
  const i = partialMatch(a.profile.interests, b.profile.interests);
  const h = partialMatch(a.profile.hobbies, b.profile.hobbies);
  const w = partialMatch(a.profile.work_style, b.profile.work_style);
  const s = partialMatch(a.profile.social_style, b.profile.social_style);
  const q = partialMatch(a.profile.qualities, b.profile.qualities);
  const n = partialMatch(a.profile.needs, b.profile.needs);

  // Weighted scoring: interests 35, hobbies 20, needs 15, work_style 12, social_style 10, qualities 8
  const raw = i.score * 35 + h.score * 20 + n.score * 15 + w.score * 12 + s.score * 10 + q.score * 8;
  const score = Math.round(Math.min(100, Math.max(0, raw)) * 10) / 10;

  // Build reasons
  const reasons = [
    ...i.hit.slice(0, 3).map(x => `shared interest: ${x}`),
    ...h.hit.slice(0, 2).map(x => `shared hobby: ${x}`),
    ...n.hit.slice(0, 2).map(x => `shared need: ${x}`),
    ...w.hit.slice(0, 2).map(x => `work-style fit: ${x}`),
  ].slice(0, 6);

  // Breakdown for detailed view
  const breakdown = {
    interests: { score: Math.round(i.score * 100), shared: i.hit.slice(0, 4) },
    hobbies: { score: Math.round(h.score * 100), shared: h.hit.slice(0, 3) },
    needs: { score: Math.round(n.score * 100), shared: n.hit.slice(0, 3) },
    work_style: { score: Math.round(w.score * 100), shared: w.hit.slice(0, 3) },
    social_style: { score: Math.round(s.score * 100), shared: s.hit.slice(0, 3) },
  };

  return { score, reasons, breakdown };
}

export function rankPeople(people) {
  return Object.fromEntries(people.map(p => [
    p.id,
    people
      .filter(x => x.id !== p.id)
      .map(x => ({ id: x.id, name: x.name, ...compatibility(p, x) }))
      .sort((a, b) => b.score - a.score)
  ]));
}
