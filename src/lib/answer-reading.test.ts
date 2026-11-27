import { describe, expect, it } from "vitest";
import { parseReading, reconcileReadings } from "./answer-reading";

describe("conferência das leituras", () => {
  it("rejeita respostas incompletas em vez de inventar alternativas", () => {
    expect(() => parseReading('{"student":"Ana","answers":"AB","doubtful":[]}', 3)).toThrow();
  });
  it("rejeita letras fora de A–E", () => {
    expect(() => parseReading('{"student":"Ana","answers":"AZ","doubtful":[]}', 2)).toThrow();
  });
  it("não escolhe uma alternativa quando as leituras discordam", () => {
    const r = reconcileReadings({ student: "Ana", answers: "ABC", doubtful: [] }, { student: "Ana", answers: "ADC", doubtful: [] });
    expect(r.answers).toEqual(["A", "-", "C"]);
    expect(r.doubtful).toEqual([1]);
  });
  it("exige conferência de marcas incertas mesmo com leituras iguais", () => {
    expect(reconcileReadings({ student: "", answers: "AB-", doubtful: [1] }, { student: "Ana", answers: "AB-", doubtful: [2] }).doubtful).toEqual([0, 1, 2]);
  });
  it("aceita exatamente 20 respostas concordantes", () => {
    const a = parseReading(JSON.stringify({ student: "Ana", answers: "ABCDE".repeat(4), doubtful: [] }), 20);
    expect(reconcileReadings(a, a).answers).toHaveLength(20);
    expect(reconcileReadings(a, a).doubtful).toEqual([]);
  });
});