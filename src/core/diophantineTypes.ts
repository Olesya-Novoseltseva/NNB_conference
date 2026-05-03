export type AlgorithmReportStatus =
  | "solved"
  | "no-solution"
  | "partial"
  | "not-applicable"
  | "bounded-search"
  | "undecidable-general";

export interface AlgorithmReport {
  id: string;
  title: string;
  applicable: boolean;
  algorithmName: string;
  status: AlgorithmReportStatus;
  explanation: string[];
  result?: string;
  checked?: number;
  total?: number;
}

export interface DiophantineAnalysisResult {
  ok: boolean;
  parseError?: string;
  classification: string;
  variables: string[];
  systemPreview: string[];
  reports: AlgorithmReport[];
}

export type LabDomain = "Z" | "Fp";

export interface AnalyzeOptions {
  domain: LabDomain;
  /** простое p для режима F_p */
  p: number;
  /** полуразмер окна [-N, N] для перебора по Z */
  limitN: number;
  /** предполагаемая скорость проверки одного вектора (для оценки времени) */
  checksPerSecond: number;
  maxChecks: number;
  /** опциональные простые для модульного препятствия */
  modularPrimes: number[];
  flags: {
    auto: boolean;
    linear: boolean;
    univariate: boolean;
    modular: boolean;
    bounded: boolean;
    estimate: boolean;
  };
}
