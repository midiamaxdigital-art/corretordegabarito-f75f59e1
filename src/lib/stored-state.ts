import { z } from "zod";

export const questionsSchema = z.array(z.object({ key: z.enum(["", "A", "B", "C", "D", "E"]), points: z.number().finite().nonnegative() })).length(20);
export const totalSchema = z.number().int().min(1).max(20);
export const historySchema = z.array(z.object({
  id: z.string(), date: z.string().datetime(), student: z.string(),
  answers: z.array(z.enum(["A", "B", "C", "D", "E", "-"])).max(20),
  earned: z.number().finite().nonnegative(), max: z.number().finite().nonnegative(),
  hits: z.number().int().min(0).max(20), total: totalSchema,
}));
export const columnsSchema = z.number().int().min(1).max(5);
export const sizeSchema = z.number().min(16).max(56);
export const gapSchema = z.number().min(0).max(40);
export const verticalSchema = z.boolean();

export function restoreStored<T>(raw: string | null, schema: z.ZodType<T>, fallback: T): T {
  if (!raw) return fallback;
  try {
    const result = schema.safeParse(JSON.parse(raw));
    return result.success ? result.data : fallback;
  } catch { return fallback; }
}