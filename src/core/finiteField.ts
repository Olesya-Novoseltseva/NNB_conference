import { extendedGcd } from "./numberTheory";

export function mod(value: number, p: number): number {
  const modulus = Math.trunc(p);
  return ((Math.trunc(value) % modulus) + modulus) % modulus;
}

export function isPrime(value: number): boolean {
  const n = Math.trunc(value);
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;

  for (let divisor = 3; divisor * divisor <= n; divisor += 2) {
    if (n % divisor === 0) return false;
  }

  return true;
}

export function add(a: number, b: number, p: number): number {
  return mod(a + b, p);
}

export function sub(a: number, b: number, p: number): number {
  return mod(a - b, p);
}

export function neg(a: number, p: number): number {
  return mod(-a, p);
}

export function mul(a: number, b: number, p: number): number {
  return mod(a * b, p);
}

export function pow(base: number, exponent: number, p: number): number {
  if (exponent < 0) {
    return pow(inv(base, p), -exponent, p);
  }

  let result = 1;
  let current = mod(base, p);
  let exp = Math.trunc(exponent);

  while (exp > 0) {
    if (exp % 2 === 1) {
      result = mul(result, current, p);
    }
    current = mul(current, current, p);
    exp = Math.floor(exp / 2);
  }

  return result;
}

export function inv(a: number, p: number): number {
  if (!isPrime(p)) {
    throw new Error(`F_${p} is not supported: p must be prime.`);
  }

  const normalized = mod(a, p);
  if (normalized === 0) {
    throw new Error("Zero has no inverse in a field.");
  }

  const result = extendedGcd(normalized, p);
  if (result.gcd !== 1) {
    throw new Error(`${normalized} has no inverse modulo ${p}.`);
  }

  return mod(result.x, p);
}
