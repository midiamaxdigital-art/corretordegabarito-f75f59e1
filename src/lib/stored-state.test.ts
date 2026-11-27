import { describe, expect, it } from "vitest";
import { restoreStored, totalSchema, historySchema, questionsSchema } from "./stored-state";

describe("restauração de dados locais", () => {
  it("recupera o padrão quando o JSON está corrompido", () => {
    expect(restoreStored("{", totalSchema, 20)).toBe(20);
  });
  it("aceita até 20 questões e rejeita valores fora do limite", () => {
    expect(restoreStored("20", totalSchema, 1)).toBe(20);
    expect(restoreStored("21", totalSchema, 20)).toBe(20);
    expect(restoreStored("0", totalSchema, 20)).toBe(20);
  });
  it("rejeita históricos que não são listas de correções válidas", () => {
    expect(restoreStored('{"student":"Ana"}', historySchema, [])).toEqual([]);
  });
  it("rejeita gabaritos incompletos sem quebrar a página", () => {
    const fallback = Array.from({ length: 20 }, () => ({ key: "", points: 1 }));
    expect(restoreStored("[]", questionsSchema, fallback)).toEqual(fallback);
  });
});