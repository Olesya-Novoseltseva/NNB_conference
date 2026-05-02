import {
  Assignment,
  Polynomial,
  evaluateFiniteField,
  evaluateInteger,
} from "./polynomial";

export interface SearchResult {
  solutions: Assignment[];
  checked: number;
  total: number;
  truncated: boolean;
}

export interface VerificationResult {
  isSolution: boolean;
  values: number[];
}

export const DEFAULT_SEARCH_LIMIT = 250_000;

function* cartesianProduct(
  variables: string[],
  values: number[],
  index = 0,
  current: Assignment = {},
): Generator<Assignment> {
  if (index === variables.length) {
    yield { ...current };
    return;
  }

  const variable = variables[index];
  for (const value of values) {
    current[variable] = value;
    yield* cartesianProduct(variables, values, index + 1, current);
  }
}

export function countIntegerSearchSpace(variableCount: number, limit: number): number {
  return (2 * Math.max(0, Math.trunc(limit)) + 1) ** variableCount;
}

export function countFiniteFieldSearchSpace(variableCount: number, p: number): number {
  return Math.trunc(p) ** variableCount;
}

export function bruteForceInteger(
  polynomial: Polynomial,
  variables: string[],
  limit: number,
  maxChecks = DEFAULT_SEARCH_LIMIT,
): SearchResult {
  const values = Array.from(
    { length: 2 * Math.max(0, Math.trunc(limit)) + 1 },
    (_, index) => index - Math.max(0, Math.trunc(limit)),
  );
  const total = countIntegerSearchSpace(variables.length, limit);
  const solutions: Assignment[] = [];
  let checked = 0;

  for (const assignment of cartesianProduct(variables, values)) {
    if (checked >= maxChecks) {
      return { solutions, checked, total, truncated: true };
    }

    checked += 1;
    if (evaluateInteger(polynomial, assignment) === 0) {
      solutions.push(assignment);
    }
  }

  return { solutions, checked, total, truncated: false };
}

export function bruteForceFiniteField(
  system: Polynomial[],
  variables: string[],
  p: number,
  maxChecks = DEFAULT_SEARCH_LIMIT,
): SearchResult {
  const values = Array.from({ length: Math.trunc(p) }, (_, index) => index);
  const total = countFiniteFieldSearchSpace(variables.length, p);
  const solutions: Assignment[] = [];
  let checked = 0;

  for (const assignment of cartesianProduct(variables, values)) {
    if (checked >= maxChecks) {
      return { solutions, checked, total, truncated: true };
    }

    checked += 1;
    if (system.every((polynomial) => evaluateFiniteField(polynomial, assignment, p) === 0)) {
      solutions.push(assignment);
    }
  }

  return { solutions, checked, total, truncated: false };
}

export function verifyAssignment(
  system: Polynomial[],
  assignment: Assignment,
  p: number,
): VerificationResult {
  const values = system.map((polynomial) => evaluateFiniteField(polynomial, assignment, p));
  return {
    values,
    isSolution: values.every((value) => value === 0),
  };
}
