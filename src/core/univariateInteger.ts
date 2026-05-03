import {
  normalizePolynomial,
  Polynomial,
  polynomialDegree,
} from "./polynomial";

function isPerfectSquare(n: number): number | null {
  if (n < 0) return null;
  const r = Math.floor(Math.sqrt(n));
  if (r * r === n) return r;
  if ((r + 1) * (r + 1) === n) return r + 1;
  return null;
}

/** положительные делители |n| */
export function positiveDivisors(n: number): number[] {
  const abs = Math.abs(Math.trunc(n));
  if (abs === 0) return [];
  const divs: number[] = [];
  for (let i = 1; i * i <= abs; i += 1) {
    if (abs % i === 0) {
      divs.push(i);
      if (i * i !== abs) divs.push(abs / i);
    }
  }
  return divs.sort((u, v) => u - v);
}

export function signedCandidateDivisors(constantTerm: number): number[] {
  if (constantTerm === 0) return [];
  const d = positiveDivisors(constantTerm);
  const out = new Set<number>();
  for (const x of d) {
    out.add(x);
    out.add(-x);
  }
  return Array.from(out).sort((a, b) => Math.abs(a) - Math.abs(b));
}

export interface UnivariateResult {
  algorithmName: string;
  variable: string;
  zeroRootMultiplicity: number;
  roots: number[];
  explanation: string[];
}

function getConstantTermValue(poly: Polynomial): number {
  let c = 0;
  for (const m of normalizePolynomial(poly).monomials) {
    const deg = Object.values(m.powers).reduce((sum, pw) => sum + pw, 0);
    if (deg === 0) c += m.coefficient;
  }
  return c;
}

function divideByVariable(poly: Polynomial, v: string): Polynomial {
  const monomials: Polynomial["monomials"] = [];
  for (const m of normalizePolynomial(poly).monomials) {
    const pv = m.powers[v] ?? 0;
    if (pv < 1) {
      throw new Error(`Многочлен не делится на ${v} без остатка.`);
    }
    const powers = { ...m.powers, [v]: pv - 1 };
    if (powers[v] === 0) delete powers[v];
    monomials.push({ coefficient: m.coefficient, powers });
  }
  return normalizePolynomial({ monomials });
}

function extractCoeffs(poly: Polynomial, v: string): Map<number, number> {
  const map = new Map<number, number>();
  for (const m of normalizePolynomial(poly).monomials) {
    const extra = Object.entries(m.powers).filter(([name, pw]) => name !== v && pw > 0);
    if (extra.length > 0) {
      throw new Error(`Одновременно встречаются переменные помимо ${v}.`);
    }
    const pow = m.powers[v] ?? 0;
    map.set(pow, (map.get(pow) ?? 0) + m.coefficient);
  }
  return map;
}

function evalCoeffMap(coeffs: Map<number, number>, x: number): number {
  let s = 0;
  for (const [pow, c] of coeffs.entries()) {
    s += c * x ** pow;
  }
  return s;
}

/**
 * Решение P(v)=0 в целых числах для одной переменной v.
 */
export function solveUnivariateInteger(poly: Polynomial, variable: string): UnivariateResult {
  const explanation: string[] = [];
  let p = normalizePolynomial(poly);

  if (p.monomials.length === 0) {
    return {
      algorithmName: "Тождественный нуль",
      variable,
      zeroRootMultiplicity: 0,
      roots: [],
      explanation: [
        "Многочлен тождественно нулевой: уравнение 0 = 0, любое целое значение переменной подходит (бесконечно много решений).",
      ],
    };
  }

  let zeroRootMultiplicity = 0;
  while (getConstantTermValue(p) === 0 && polynomialDegree(p) > 0) {
    try {
      p = divideByVariable(p, variable);
      zeroRootMultiplicity += 1;
    } catch {
      break;
    }
  }

  if (zeroRootMultiplicity > 0) {
    explanation.push(
      `${variable}=0 — корень (кратность не ниже ${zeroRootMultiplicity}) за счёт вынесения ${variable}^${zeroRootMultiplicity}.`,
    );
  }

  if (p.monomials.length === 0 || polynomialDegree(p) === 0) {
    const c = p.monomials.length ? getConstantTermValue(p) : 0;
    if (c !== 0) {
      return {
        algorithmName: "Непротиворечивость после факторизации",
        variable,
        zeroRootMultiplicity,
        roots: zeroRootMultiplicity > 0 ? [0] : [],
        explanation: [
          ...explanation,
          `После вынесения степеней ${variable} осталась ненулевая константа ${c} = 0 — других целых корней нет.`,
        ],
      };
    }
    return {
      algorithmName: "Тождественный нуль после факторизации",
      variable,
      zeroRootMultiplicity,
      roots: zeroRootMultiplicity > 0 ? [0] : [],
      explanation: [...explanation, "Оставшаяся часть тождественно нулевая."],
    };
  }

  const coeffs = extractCoeffs(p, variable);
  const deg = polynomialDegree(p);
  explanation.push(`Степень уравнения после вынесения корня 0: ${deg}.`);

  const baseRoots: number[] = [];
  if (zeroRootMultiplicity > 0) baseRoots.push(0);

  if (deg === 1) {
    const a = coeffs.get(1) ?? 0;
    const c0 = coeffs.get(0) ?? 0;
    if (a === 0) {
      return {
        algorithmName: "Вырожденная линейная форма",
        variable,
        zeroRootMultiplicity,
        roots: baseRoots,
        explanation: [...explanation, "Коэффициент при первой степени обнулился."],
      };
    }
    if (c0 % a !== 0) {
      return {
        algorithmName: "Линейное уравнение ax + b = 0",
        variable,
        zeroRootMultiplicity,
        roots: baseRoots,
        explanation: [...explanation, `Целого решения нет: x = ${-c0}/${a} нецелое.`],
      };
    }
    const x = -c0 / a;
    const roots = [...new Set([...baseRoots, x])].sort((u, v) => u - v);
    return {
      algorithmName: "Линейное уравнение ax + b = 0",
      variable,
      zeroRootMultiplicity,
      roots,
      explanation: [...explanation, `Целый корень: ${variable} = ${x}.`],
    };
  }

  if (deg === 2) {
    const a = coeffs.get(2) ?? 0;
    const b = coeffs.get(1) ?? 0;
    const c0 = coeffs.get(0) ?? 0;
    const D = b * b - 4 * a * c0;
    const sq = isPerfectSquare(D);
    if (sq === null) {
      explanation.push(
        D < 0
          ? `D = ${D} < 0 — действительных корней нет.`
          : `D = ${D} не квадрат целого — корни нерациональны/нецелые в такой постановке.`,
      );
      return {
        algorithmName: "Квадратное уравнение (дискриминант)",
        variable,
        zeroRootMultiplicity,
        roots: baseRoots,
        explanation,
      };
    }
    const den = 2 * a;
    const n1 = -b + sq;
    const n2 = -b - sq;
    const cand = new Set<number>(baseRoots);
    if (den !== 0 && n1 % den === 0) cand.add(n1 / den);
    if (den !== 0 && n2 % den === 0) cand.add(n2 / den);
    const roots = [...cand].sort((u, v) => u - v);
    explanation.push(`D = ${sq}²; целые корни из формулы: ${[...cand].filter((x) => !baseRoots.includes(x) || x !== 0).join(", ") || "нет дополнительных к нулю"}.`);
    return {
      algorithmName: "Квадратное уравнение (дискриминант)",
      variable,
      zeroRootMultiplicity,
      roots,
      explanation,
    };
  }

  const c0 = coeffs.get(0) ?? 0;
  const candidates = signedCandidateDivisors(c0);
  explanation.push(
    `Степень ≥ 3: ищем целые среди делителей свободного члена (${candidates.length} кандидатов); это не исчерпывает все возможные методы (см. алгебру).`,
  );
  const found = new Set<number>(baseRoots);
  for (const cand of candidates) {
    if (evalCoeffMap(coeffs, cand) === 0) found.add(cand);
  }
  const roots = [...found].sort((u, v) => u - v);
  explanation.push(
    roots.length > baseRoots.length || (baseRoots.length === 0 && roots.length > 0)
      ? `Найдены целые корни: ${roots.join(", ")}.`
      : "Среди делителей свободного члена новых целых корней нет.",
  );

  return {
    algorithmName: "Теорема о рациональных корнях (только целые кандидаты)",
    variable,
    zeroRootMultiplicity,
    roots,
    explanation,
  };
}
