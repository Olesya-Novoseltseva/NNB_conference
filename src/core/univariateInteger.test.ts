import { describe, expect, it } from "vitest";
import { parseEquation } from "./polynomial";
import { solveUnivariateInteger } from "./univariateInteger";

describe("solveUnivariateInteger", () => {
  it("x^2-5x+6=0", () => {
    const r = solveUnivariateInteger(parseEquation("x^2 - 5*x + 6 = 0"), "x");
    expect(r.roots.sort((a, b) => a - b)).toEqual([2, 3]);
  });

  it("линейное 2x-4=0", () => {
    const r = solveUnivariateInteger(parseEquation("2*x - 4 = 0"), "x");
    expect(r.roots).toContain(2);
  });
});
