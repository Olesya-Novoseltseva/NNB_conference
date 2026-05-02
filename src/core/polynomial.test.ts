import { describe, expect, it } from "vitest";
import { evaluateFiniteField, evaluateInteger, parseEquation, parsePolynomial } from "./polynomial";

describe("polynomials", () => {
  it("evaluates integer polynomials", () => {
    const poly = parsePolynomial("x^2 + 2*x*y + y^2");
    expect(evaluateInteger(poly, { x: 2, y: 3 })).toBe(25);
  });

  it("evaluates equations as left minus right", () => {
    const poly = parseEquation("x^2 + y = 5");
    expect(evaluateInteger(poly, { x: 2, y: 1 })).toBe(0);
  });

  it("evaluates polynomials over finite fields", () => {
    const poly = parsePolynomial("x^2 + 2*x*y + y^2");
    expect(evaluateFiniteField(poly, { x: 2, y: 3 }, 5)).toBe(0);
  });
});
