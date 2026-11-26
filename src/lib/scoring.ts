export type Question = { key: string; points: number };
export function score(questions: Question[], answers: string[]) {
  let earned = 0;
  let max = 0;
  const results = questions.map((q, i) => {
    const ok = !!q.key && answers[i] === q.key;
    max += q.points;
    if (ok) earned += q.points;
    return ok;
  });
  return { earned: Math.round(earned * 100) / 100, max: Math.round(max * 100) / 100, results, hits: results.filter(Boolean).length };
}
