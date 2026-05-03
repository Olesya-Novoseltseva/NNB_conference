import { describe, expect, it } from "vitest";
import { parseEquation } from "./polynomial";
import { bruteForceIntegerSystem } from "./search";

describe("bruteForceIntegerSystem", () => {
  it("находит решение x+y=2, x-y=0 в окне", () => {
    const p1 = parseEquation("x + y - 2 = 0");
    const p2 = parseEquation("x - y = 0");
    const r = bruteForceIntegerSystem([p1, p2], ["x", "y"], 3, 1000);
    expect(r.solutions.some((s) => s.x === 1 && s.y === 1)).toBe(true);
  });
});
