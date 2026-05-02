import { demoClauses } from "../core/satToMq";

export const linearExamples = {
  solvable: { a: 14, b: 21, c: 7, label: "14x + 21y = 7" },
  unsolvable: { a: 6, b: 10, c: 7, label: "6x + 10y = 7" },
};

export const integerSearchExamples = {
  pellWindow: {
    equation: "x^2 - 2*y^2 - 1 = 0",
    limit: 8,
    variables: ["x", "y"],
  },
};

export const finiteFieldExamples = {
  gf2System: {
    p: 2,
    equations: ["x1*x2 + x3 = 0", "x1 + x2 + 1 = 0"],
    witness: { x1: 1, x2: 0, x3: 0 },
  },
};

export const growthExamples = [
  { label: "F_2^10", p: 2, variables: 10 },
  { label: "F_2^20", p: 2, variables: 20 },
  { label: "F_3^15", p: 3, variables: 15 },
];

export const mqExample = {
  clauses: demoClauses,
  satisfyingWitness: { x1: 1, x2: 0, x3: 1, y1: 0, y2: 1 },
};
