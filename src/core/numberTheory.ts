export interface ExtendedGcdResult {
  gcd: number;
  x: number;
  y: number;
}

export interface LinearDiophantineSolution {
  hasSolution: true;
  gcd: number;
  x0: number;
  y0: number;
  stepX: number;
  stepY: number;
}

export interface LinearDiophantineNoSolution {
  hasSolution: false;
  gcd: number;
  reason: string;
}

export type LinearDiophantineResult =
  | LinearDiophantineSolution
  | LinearDiophantineNoSolution;

export interface Point2D {
  x: number;
  y: number;
}

export function gcdMany(values: number[]): number {
  if (values.length === 0) return 0;
  let result = Math.abs(Math.trunc(values[0]));
  for (let i = 1; i < values.length; i += 1) {
    result = gcd(result, Math.abs(Math.trunc(values[i])));
  }
  return result;
}

export function gcd(a: number, b: number): number {
  let left = Math.abs(Math.trunc(a));
  let right = Math.abs(Math.trunc(b));

  while (right !== 0) {
    const next = left % right;
    left = right;
    right = next;
  }

  return left;
}

export function extendedGcd(a: number, b: number): ExtendedGcdResult {
  let oldR = Math.trunc(a);
  let r = Math.trunc(b);
  let oldS = 1;
  let s = 0;
  let oldT = 0;
  let t = 1;

  while (r !== 0) {
    const quotient = Math.trunc(oldR / r);

    [oldR, r] = [r, oldR - quotient * r];
    [oldS, s] = [s, oldS - quotient * s];
    [oldT, t] = [t, oldT - quotient * t];
  }

  if (oldR < 0) {
    return { gcd: -oldR, x: -oldS, y: -oldT };
  }

  return { gcd: oldR, x: oldS, y: oldT };
}

export function solveLinearDiophantine(
  a: number,
  b: number,
  c: number,
): LinearDiophantineResult {
  const aa = Math.trunc(a);
  const bb = Math.trunc(b);
  const cc = Math.trunc(c);

  if (aa === 0 && bb === 0) {
    if (cc === 0) {
      return {
        hasSolution: true,
        gcd: 0,
        x0: 0,
        y0: 0,
        stepX: 1,
        stepY: 0,
      };
    }

    return {
      hasSolution: false,
      gcd: 0,
      reason: "0*x + 0*y не может равняться ненулевому c.",
    };
  }

  const bezout = extendedGcd(aa, bb);
  if (cc % bezout.gcd !== 0) {
    return {
      hasSolution: false,
      gcd: bezout.gcd,
      reason: `gcd(${aa}, ${bb}) = ${bezout.gcd} не делит ${cc}.`,
    };
  }

  const multiplier = cc / bezout.gcd;
  return {
    hasSolution: true,
    gcd: bezout.gcd,
    x0: bezout.x * multiplier,
    y0: bezout.y * multiplier,
    stepX: bb / bezout.gcd,
    stepY: -aa / bezout.gcd,
  };
}

export function rangePoints2D(limit: number): Point2D[] {
  const safeLimit = Math.max(0, Math.trunc(limit));
  const points: Point2D[] = [];

  for (let x = -safeLimit; x <= safeLimit; x += 1) {
    for (let y = -safeLimit; y <= safeLimit; y += 1) {
      points.push({ x, y });
    }
  }

  return points;
}

export function linearSolutionPoints(
  a: number,
  b: number,
  c: number,
  limit: number,
): Point2D[] {
  return rangePoints2D(limit).filter((point) => a * point.x + b * point.y === c);
}
