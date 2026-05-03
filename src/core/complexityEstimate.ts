/**
 * Оценка времени полного перебора в окне и человекочитаемый вывод.
 */

export function estimateSecondsForChecks(totalChecks: number, checksPerSecond: number): number {
  const t = Math.max(1, Math.trunc(totalChecks));
  const rate = Math.max(1e-6, checksPerSecond);
  return t / rate;
}

export function formatHumanDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 1) return `≈ ${(seconds * 1000).toFixed(0)} мс`;
  if (seconds < 60) return `≈ ${seconds.toFixed(1)} с`;
  if (seconds < 3600) return `≈ ${(seconds / 60).toFixed(1)} мин`;
  if (seconds < 86400) return `≈ ${(seconds / 3600).toFixed(1)} ч`;
  if (seconds < 86400 * 365.25) return `≈ ${(seconds / 86400).toFixed(1)} сут`;
  return `≈ ${(seconds / (86400 * 365.25)).toFixed(1)} лет`;
}

export function formatBigNumber(n: number): string {
  if (!Number.isFinite(n)) return "∞";
  if (Math.abs(n) < 1e21) return n.toLocaleString("ru-RU");
  return n.toExponential(4);
}
