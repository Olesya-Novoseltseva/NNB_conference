import { isPrime } from "./finiteField";
import { bruteForceFiniteField } from "./search";
import { Polynomial } from "./polynomial";

export interface ModularStep {
  p: number;
  solvable: boolean;
  checked: number;
  total: number;
  truncated: boolean;
}

/**
 * Для каждого простого p: если система не имеет решения в (Z/pZ)^n при полном переборе,
 * то не имеет и в Z^n.
 */
export function findModularObstruction(
  system: Polynomial[],
  variables: string[],
  primes: number[],
  maxChecksPerPrime = 250_000,
): { obstructingPrime: number | null; steps: ModularStep[] } {
  const steps: ModularStep[] = [];

  for (const p of primes) {
    if (!isPrime(p)) continue;
    const res = bruteForceFiniteField(system, variables, p, maxChecksPerPrime);
    const step: ModularStep = {
      p,
      solvable: res.solutions.length > 0,
      checked: res.checked,
      total: res.total,
      truncated: res.truncated,
    };
    steps.push(step);
    if (!res.solutions.length && !res.truncated) {
      return { obstructingPrime: p, steps };
    }
  }

  return { obstructingPrime: null, steps };
}
