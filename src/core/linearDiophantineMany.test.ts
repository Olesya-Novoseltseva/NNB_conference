import { describe, expect, it } from "vitest";
import { solveLinearDiophantineMany } from "./linearDiophantineMany";

describe("solveLinearDiophantineMany", () => {
  it("решение для 14x+21y=7 (внутри как одно уравнение с двумя коэф.)", () => {
    const r = solveLinearDiophantineMany([14, 21], 7);
    expect(r.hasSolution).toBe(true);
    if (r.hasSolution) expect(14 * r.particular[0] + 21 * r.particular[1]).toBe(7);
  });

  it("отказ для 6x+10y=7", () => {
    const r = solveLinearDiophantineMany([6, 10], 7);
    expect(r.hasSolution).toBe(false);
  });

  it("три переменные: 2x+3y+4z=7", () => {
    const r = solveLinearDiophantineMany([2, 3, 4], 7);
    expect(r.hasSolution).toBe(true);
    if (r.hasSolution) {
      const [x, y, z] = r.particular;
      expect(2 * x + 3 * y + 4 * z).toBe(7);
    }
  });

  it("делимость при отрицательном a", () => {
    const r = solveLinearDiophantineMany([-3], 6);
    expect(r.hasSolution).toBe(true);
    if (r.hasSolution) expect(r.particular[0] * -3).toBe(6);
  });
});
