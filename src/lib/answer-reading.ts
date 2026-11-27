import { z } from "zod";

export function parseReading(text: string, total: number) {
  return z.object({
    student: z.string().max(200),
    answers: z.string().regex(new RegExp(`^[ABCDE-]{${total}}$`)),
    doubtful: z.array(z.number().int().min(1).max(total)).max(total),
  }).strict().parse(JSON.parse(text));
}

export function reconcileReadings(a: ReturnType<typeof parseReading>, b: ReturnType<typeof parseReading>) {
  if (a.answers.length !== b.answers.length) throw new Error("Leituras incompletas");
  const uncertain = new Set([...a.doubtful, ...b.doubtful].map((n) => n - 1));
  const answers = [...a.answers].map((answer, i) => {
    if (answer !== b.answers[i]) { uncertain.add(i); return "-"; }
    if (answer === "-") uncertain.add(i);
    return answer;
  });
  return { student: a.student.trim() || b.student.trim(), answers, doubtful: [...uncertain].sort((x, y) => x - y) };
}