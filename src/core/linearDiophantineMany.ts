import { extendedGcd, gcd, gcdMany } from "./numberTheory";

export interface LinearManySolution {
  hasSolution: true;
  gcdAll: number;
  /** одно целочисленное решение в том же порядке, что и varNames */
  particular: number[];
}

export interface LinearManyNoSolution {
  hasSolution: false;
  gcdAll: number;
  reason: string;
}

export type LinearManyResult = LinearManySolution | LinearManyNoSolution;

/**
 * Одно линейное диофантово уравнение a₁x₁ + … + aₙxₙ = c.
 * Строит одно частное решение цепочкой рекурсии и расширенного алгоритма Евклида для пары (gcd(a₁,…,aₙ₋₁), aₙ).
 */
export function solveLinearDiophantineMany(coeffs: number[], c: number): LinearManyResult {
  const cc = Math.trunc(c);
  const a = coeffs.map((v) => Math.trunc(v));
  const n = a.length;

  if (n === 0) {
    return cc === 0
      ? { hasSolution: true, gcdAll: 0, particular: [] }
      : { hasSolution: false, gcdAll: 0, reason: "Нет переменных и правая часть ненулевая." };
  }

  if (n === 1) {
    const a0 = a[0];
    if (a0 === 0) {
      return cc === 0
        ? { hasSolution: true, gcdAll: 0, particular: [0] }
        : { hasSolution: false, gcdAll: 0, reason: "Коэффициент при переменной равен 0, c ≠ 0." };
    }
    const g = Math.abs(a0);
    const q = Math.trunc(cc / a0);
    if (a0 * q !== cc) {
      return {
        hasSolution: false,
        gcdAll: g,
        reason: `${a0} не делит ${cc} в Z.`,
      };
    }
    return { hasSolution: true, gcdAll: g, particular: [q] };
  }

  const d = gcdMany(a);
  if (d === 0) {
    return cc === 0
      ? { hasSolution: true, gcdAll: 0, particular: Array(n).fill(0) }
      : { hasSolution: false, gcdAll: 0, reason: "Все коэффициенты нули, c ≠ 0." };
  }

  if (cc % d !== 0) {
    return {
      hasSolution: false,
      gcdAll: d,
      reason: `gcd(${a.join(", ")}) = ${d} не делит ${cc}.`,
    };
  }

  const first = a.slice(0, -1);
  const an = a[n - 1];
  let gPrev = Math.abs(first[0]);
  for (let i = 1; i < first.length; i += 1) {
    gPrev = gcd(gPrev, Math.abs(first[i]));
  }

  const bez = extendedGcd(gPrev, an);
  const mult = cc / bez.gcd;
  const yComb = bez.x * mult;
  const targetForPrefix = gPrev * yComb;

  const sub = solveLinearDiophantineMany(first, targetForPrefix);
  if (!sub.hasSolution) {
    return {
      hasSolution: false,
      gcdAll: d,
      reason: "Внутренняя ошибка рекурсии линейного решателя.",
    };
  }

  return {
    hasSolution: true,
    gcdAll: d,
    particular: [...sub.particular, bez.y * mult],
  };
}
