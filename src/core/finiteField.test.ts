import { describe, expect, it } from "vitest";
import { add, inv, isPrime, mul, pow, sub } from "./finiteField";

describe("finite field arithmetic", () => {
  it("detects prime moduli", () => {
    expect(isPrime(2)).toBe(true);
    expect(isPrime(5)).toBe(true);
    expect(isPrime(9)).toBe(false);
  });

  it("performs arithmetic modulo p", () => {
    expect(add(2, 4, 5)).toBe(1);
    expect(sub(1, 4, 5)).toBe(2);
    expect(mul(3, 4, 5)).toBe(2);
    expect(pow(3, 3, 5)).toBe(2);
  });

  it("finds inverse elements", () => {
    expect(inv(2, 5)).toBe(3);
    expect(mul(2, inv(2, 5), 5)).toBe(1);
  });
});
