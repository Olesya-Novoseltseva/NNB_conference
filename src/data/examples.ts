import { demoClauses } from "../core/satToMq";

export const growthExamples = [
  { label: "F_2^10", p: 2, variables: 10 },
  { label: "F_2^20", p: 2, variables: 20 },
  { label: "F_3^15", p: 3, variables: 15 },
];

export const mqExample = {
  clauses: demoClauses,
  satisfyingWitness: { x1: 1, x2: 0, x3: 1, y1: 0, y2: 1 },
};
