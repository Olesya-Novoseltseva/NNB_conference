import { describe, expect, it } from "vitest";
import { parseEquation } from "./polynomial";
import { bruteForceFiniteField, bruteForceInteger, verifyAssignment } from "./search";

describe("search", () => {
  it("finds integer solutions in a bounded window", () => {
    const poly = parseEquation("x + y = 0");
    const result = bruteForceInteger(poly, ["x", "y"], 1);
    expect(result.solutions).toEqual(
      expect.arrayContaining([
        { x: -1, y: 1 },
        { x: 0, y: 0 },
        { x: 1, y: -1 },
      ]),
    );
  });

  it("finds finite-field solutions", () => {
    const system = [parseEquation("x1*x2 + x3 = 0"), parseEquation("x1 + x2 + 1 = 0")];
    const result = bruteForceFiniteField(system, ["x1", "x2", "x3"], 2);
    expect(result.solutions.length).toBeGreaterThan(0);
    expect(verifyAssignment(system, result.solutions[0], 2).isSolution).toBe(true);
  });
});
