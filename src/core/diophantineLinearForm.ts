import { normalizePolynomial, Polynomial } from "./polynomial";
import { solveLinearDiophantineMany } from "./linearDiophantineMany";

export interface LinearForm {
  vars: string[];
  coeffs: number[];
  rhs: number;
}

/**
 * Извлечь линейную форму Σ aᵢ xᵢ = rhs из уравнения P=0, если deg ≤ 1.
 */
export function extractLinearForm(poly: Polynomial): LinearForm | null {
  const normalized = normalizePolynomial(poly);
  let constTerm = 0;
  const coeffMap = new Map<string, number>();

  for (const m of normalized.monomials) {
    const deg = Object.values(m.powers).reduce((sum, power) => sum + power, 0);
    if (deg === 0) {
      constTerm += m.coefficient;
    } else if (deg === 1) {
      const active = Object.entries(m.powers).filter(([, power]) => power > 0);
      if (active.length !== 1 || active[0][1] !== 1) return null;
      const v = active[0][0];
      coeffMap.set(v, (coeffMap.get(v) ?? 0) + m.coefficient);
    } else {
      return null;
    }
  }

  const vars = Array.from(coeffMap.keys()).sort((a, b) => a.localeCompare(b));
  const coeffs = vars.map((v) => coeffMap.get(v)!);
  return { vars, coeffs, rhs: -constTerm };
}

/**
 * Две линейные формы в одних и тех же двух переменных (лексикографический порядок имён).
 */
export function trySolveLinearSystem2x2(
  line1: LinearForm,
  line2: LinearForm,
):
  | { ok: true; assignment: Record<string, number>; note?: string }
  | { ok: false; reason: string } {
  if (line1.vars.length !== 2 || line2.vars.length !== 2) {
    return { ok: false, reason: "Каждое уравнение должно содержать ровно две переменные." };
  }
  if (line1.vars[0] !== line2.vars[0] || line1.vars[1] !== line2.vars[1]) {
    return { ok: false, reason: "Разный набор или порядок переменных в строках." };
  }

  const [vx, vy] = line1.vars;
  const a11 = line1.coeffs[0];
  const a12 = line1.coeffs[1];
  const b1 = line1.rhs;
  const a21 = line2.coeffs[0];
  const a22 = line2.coeffs[1];
  const b2 = line2.rhs;

  const tryFirstOnly = (): { ok: true; assignment: Record<string, number>; note?: string } | { ok: false; reason: string } => {
    const m = solveLinearDiophantineMany(line1.coeffs, line1.rhs);
    if (!m.hasSolution) return { ok: false, reason: m.reason };
    return {
      ok: true,
      assignment: { [vx]: m.particular[0], [vy]: m.particular[1] },
      note: "Вторая строка тождественна 0 = 0.",
    };
  };

  const trySecondOnly = (): { ok: true; assignment: Record<string, number>; note?: string } | { ok: false; reason: string } => {
    const m = solveLinearDiophantineMany(line2.coeffs, line2.rhs);
    if (!m.hasSolution) return { ok: false, reason: m.reason };
    return {
      ok: true,
      assignment: { [vx]: m.particular[0], [vy]: m.particular[1] },
      note: "Первая строка тождественна 0 = 0.",
    };
  };

  const D = a11 * a22 - a12 * a21;
  if (D !== 0) {
    const numX = b1 * a22 - b2 * a12;
    const numY = a11 * b2 - a21 * b1;
    if (numX % D !== 0 || numY % D !== 0) {
      return {
        ok: false,
        reason:
          "Определитель ненулевой, но решение Крамера нецелое — нет целочисленных решений этой 2×2 системы.",
      };
    }
    return {
      ok: true,
      assignment: { [vx]: numX / D, [vy]: numY / D },
    };
  }

  if (a11 === 0 && a12 === 0) {
    if (b1 !== 0) return { ok: false, reason: "Первая строка: 0 = ненулю." };
    return trySecondOnly();
  }
  if (a21 === 0 && a22 === 0) {
    if (b2 !== 0) return { ok: false, reason: "Вторая строка: 0 = ненулю." };
    return tryFirstOnly();
  }

  const many = solveLinearDiophantineMany(line1.coeffs, line1.rhs);
  if (!many.hasSolution) return { ok: false, reason: many.reason };
  const x0 = many.particular[0];
  const y0 = many.particular[1];
  if (a21 * x0 + a22 * y0 !== b2) {
    return {
      ok: false,
      reason:
        "Определитель 0: строки пропорциональны по левой части, но правая часть даёт несовместную систему над Z.",
    };
  }
  return {
    ok: true,
    assignment: { [vx]: x0, [vy]: y0 },
    note: "Система вырождена (определитель 0); показано одно целочисленное решение из (возможно) бесконечного семейства.",
  };
}
