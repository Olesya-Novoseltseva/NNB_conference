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

export interface LabPreset {
  id: string;
  title: string;
  description: string;
  systemText: string;
  domain: "Z" | "Fp";
  p: number;
  limitN: number;
  maxChecks: number;
  autoAll: boolean;
  useDeviceSpeed: boolean;
  checksPerSecond?: number;
  flags?: {
    linear: boolean;
    univariate: boolean;
    modular: boolean;
    estimate: boolean;
    bounded: boolean;
  };
}

export const labPresets: LabPreset[] = [
  {
    id: "lin-2x2-solvable",
    title: "Линейная система 2x2 (решаемая)",
    description: "Проверка Крамера и точного целочисленного решения.",
    systemText: "x + y = 5\n2*x - y = 1",
    domain: "Z",
    p: 3,
    limitN: 8,
    maxChecks: 250_000,
    autoAll: true,
    useDeviceSpeed: true,
  },
  {
    id: "lin-2x2-integer-blocked",
    title: "Линейная система 2x2 (нецелая точка)",
    description: "Определитель ненулевой, но решение не в целых числах.",
    systemText: "2*x + y = 1\nx - y = 0",
    domain: "Z",
    p: 3,
    limitN: 8,
    maxChecks: 250_000,
    autoAll: true,
    useDeviceSpeed: true,
  },
  {
    id: "lin-many-divisible",
    title: "Одно линейное, 3 переменные (есть решение)",
    description: "Проверка делимости gcd и частного решения.",
    systemText: "6*x + 9*y + 15*z = 12",
    domain: "Z",
    p: 3,
    limitN: 7,
    maxChecks: 250_000,
    autoAll: true,
    useDeviceSpeed: true,
  },
  {
    id: "lin-many-no-solution",
    title: "Одно линейное, 2 переменные (нет решения)",
    description: "gcd коэффициентов не делит правую часть.",
    systemText: "6*x + 10*y = 7",
    domain: "Z",
    p: 3,
    limitN: 7,
    maxChecks: 250_000,
    autoAll: true,
    useDeviceSpeed: true,
  },
  {
    id: "uni-quadratic",
    title: "Однопеременное квадратное",
    description: "Дискриминант и явные целые корни.",
    systemText: "x^2 - 5*x + 6 = 0",
    domain: "Z",
    p: 3,
    limitN: 10,
    maxChecks: 250_000,
    autoAll: true,
    useDeviceSpeed: true,
  },
  {
    id: "uni-high-degree",
    title: "Однопеременное степени >= 3",
    description: "Проверка делителей свободного члена.",
    systemText: "x^4 - 5*x^2 + 4 = 0",
    domain: "Z",
    p: 3,
    limitN: 12,
    maxChecks: 250_000,
    autoAll: true,
    useDeviceSpeed: true,
  },
  {
    id: "mod-obstruction",
    title: "Модульное препятствие",
    description: "Нет решений mod p, значит нет и в Z.",
    systemText: "2*x + 1 = 0",
    domain: "Z",
    p: 3,
    limitN: 6,
    maxChecks: 250_000,
    autoAll: false,
    useDeviceSpeed: true,
    flags: {
      linear: false,
      univariate: false,
      modular: true,
      estimate: true,
      bounded: false,
    },
  },
  {
    id: "bounded-cube-search",
    title: "Ограниченный перебор в окне",
    description: "Полный просмотр куба [-N,N]^k с отчетом о покрытии.",
    systemText: "x^2 + y^2 - 50 = 0",
    domain: "Z",
    p: 3,
    limitN: 6,
    maxChecks: 1_000_000,
    autoAll: false,
    useDeviceSpeed: true,
    flags: {
      linear: false,
      univariate: false,
      modular: true,
      estimate: true,
      bounded: true,
    },
  },
  {
    id: "fp-solvable",
    title: "Система над F_p (есть решения)",
    description: "Поиск по конечному пространству p^n.",
    systemText: "x + y = 1\nx - y = 0",
    domain: "Fp",
    p: 5,
    limitN: 8,
    maxChecks: 250_000,
    autoAll: true,
    useDeviceSpeed: false,
  },
  {
    id: "fp-unsat-small",
    title: "Система над F_p (может быть пусто)",
    description: "Демонстрация no-solution/partial в режиме поля.",
    systemText: "x^2 + 1 = 0",
    domain: "Fp",
    p: 3,
    limitN: 8,
    maxChecks: 250_000,
    autoAll: true,
    useDeviceSpeed: false,
  },
];
