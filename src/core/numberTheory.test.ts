import { describe, expect, it } from "vitest";
import { extendedGcd, solveLinearDiophantine } from "./numberTheory";

describe("number theory", () => {
  it("computes Bezout coefficients", () => {
    const result = extendedGcd(14, 21);
    expect(result.gcd).toBe(7);
    expect(14 * result.x + 21 * result.y).toBe(7);
  });

  it("solves a linear Diophantine equation", () => {
    const result = solveLinearDiophantine(14, 21, 7);
    expect(result.hasSolution).toBe(true);
    if (result.hasSolution) {
      expect(14 * result.x0 + 21 * result.y0).toBe(7);
    }
  });

  it("rejects a linear Diophantine equation when gcd does not divide c", () => {
    const result = solveLinearDiophantine(6, 10, 7);
    expect(result.hasSolution).toBe(false);
    expect(result.gcd).toBe(2);
  });
});
