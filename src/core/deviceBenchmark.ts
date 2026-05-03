import { evaluateInteger, parseEquation, Polynomial } from "./polynomial";

export interface DeviceBenchmarkResult {
  /** Проверок вида «подстановка + все уравнения цикла» в секунду */
  checksPerSecond: number;
  /** Время прогона цикла в мс */
  durationMs: number;
  /** Число вызовов evaluateInteger за прогон */
  iterations: number;
}

let cache: DeviceBenchmarkResult | null = null;

export function getCachedDeviceBenchmark(): DeviceBenchmarkResult | null {
  return cache;
}

/** Для тестов: сброс кэша между прогонами */
export function clearDeviceBenchmarkCache(): void {
  cache = null;
}

/**
 * Цикл, близкий к шагу перебора в лаборатории: evaluateInteger по каждому уравнению малой системы.
 * Результат кэшируется на время жизни вкладки.
 */
export function runIntegerAssignmentBenchmark(
  outerIterations = 50_000,
): DeviceBenchmarkResult {
  if (cache) return cache;

  const system: Polynomial[] = [
    parseEquation("x*x + x*y + z^3 + 2*x - 7"),
    parseEquation("x*y - 3*z + 1"),
  ];
  const assignment: Record<string, number> = { x: 0, y: 0, z: 0 };

  const t0 = performance.now();
  for (let i = 0; i < outerIterations; i += 1) {
    assignment.x = (i % 11) - 5;
    assignment.y = (i % 13) - 6;
    assignment.z = (i % 7) - 3;
    for (const poly of system) {
      evaluateInteger(poly, assignment);
    }
  }
  const t1 = performance.now();

  const durationMs = Math.max(t1 - t0, 1e-6);
  const innerOps = outerIterations * system.length;
  const checksPerSecond = Math.max(
    1000,
    Math.round((innerOps / durationMs) * 1000),
  );

  cache = { checksPerSecond, durationMs, iterations: innerOps };
  return cache;
}
