import { describe, it, expect } from "vitest";
import { score } from "./scoring";
describe("score", () => {
  it("soma apenas a pontuação das questões certas", () => {
    const r = score([{ key: "A", points: 2 }, { key: "B", points: 0.5 }, { key: "C", points: 1 }], ["A", "C", "C"]);
    expect(r.earned).toBe(3);
    expect(r.max).toBe(3.5);
    expect(r.hits).toBe(2);
  });
  it("questão em branco não pontua", () => {
    expect(score([{ key: "A", points: 1 }], ["-"]).earned).toBe(0);
  });
});
