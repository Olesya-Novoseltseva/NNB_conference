import { mod, pow as fieldPow } from "./finiteField";

export type Assignment = Record<string, number>;

export interface Monomial {
  coefficient: number;
  powers: Record<string, number>;
}

export interface Polynomial {
  monomials: Monomial[];
}

type TokenType = "number" | "variable" | "operator" | "leftParen" | "rightParen";

interface Token {
  type: TokenType;
  value: string;
}

export const zeroPolynomial = (): Polynomial => ({ monomials: [] });

export const constantPolynomial = (coefficient: number): Polynomial =>
  coefficient === 0 ? zeroPolynomial() : { monomials: [{ coefficient, powers: {} }] };

export const variablePolynomial = (name: string): Polynomial => ({
  monomials: [{ coefficient: 1, powers: { [name]: 1 } }],
});

function monomialKey(powers: Record<string, number>): string {
  return Object.entries(powers)
    .filter(([, power]) => power !== 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([variable, power]) => `${variable}^${power}`)
    .join("*");
}

export function normalizePolynomial(poly: Polynomial): Polynomial {
  const terms = new Map<string, Monomial>();

  for (const monomial of poly.monomials) {
    const powers = Object.fromEntries(
      Object.entries(monomial.powers).filter(([, power]) => power !== 0),
    );
    const key = monomialKey(powers);
    const previous = terms.get(key);

    if (previous) {
      previous.coefficient += monomial.coefficient;
    } else {
      terms.set(key, { coefficient: monomial.coefficient, powers });
    }
  }

  return {
    monomials: Array.from(terms.values()).filter((monomial) => monomial.coefficient !== 0),
  };
}

export function addPolynomials(left: Polynomial, right: Polynomial): Polynomial {
  return normalizePolynomial({ monomials: [...left.monomials, ...right.monomials] });
}

export function negatePolynomial(poly: Polynomial): Polynomial {
  return {
    monomials: poly.monomials.map((monomial) => ({
      coefficient: -monomial.coefficient,
      powers: { ...monomial.powers },
    })),
  };
}

export function subtractPolynomials(left: Polynomial, right: Polynomial): Polynomial {
  return addPolynomials(left, negatePolynomial(right));
}

export function multiplyPolynomials(left: Polynomial, right: Polynomial): Polynomial {
  const monomials: Monomial[] = [];

  for (const leftTerm of left.monomials) {
    for (const rightTerm of right.monomials) {
      const powers: Record<string, number> = { ...leftTerm.powers };
      for (const [variable, power] of Object.entries(rightTerm.powers)) {
        powers[variable] = (powers[variable] ?? 0) + power;
      }
      monomials.push({
        coefficient: leftTerm.coefficient * rightTerm.coefficient,
        powers,
      });
    }
  }

  return normalizePolynomial({ monomials });
}

export function powerPolynomial(poly: Polynomial, exponent: number): Polynomial {
  const exp = Math.trunc(exponent);
  if (exp < 0) {
    throw new Error("Negative powers are not supported for polynomials.");
  }

  let result = constantPolynomial(1);
  for (let i = 0; i < exp; i += 1) {
    result = multiplyPolynomials(result, poly);
  }

  return result;
}

export function evaluateInteger(poly: Polynomial, assignment: Assignment): number {
  return poly.monomials.reduce((total, monomial) => {
    const value = Object.entries(monomial.powers).reduce(
      (product, [variable, power]) => product * Math.trunc(assignment[variable] ?? 0) ** power,
      monomial.coefficient,
    );
    return total + value;
  }, 0);
}

export function evaluateFiniteField(
  poly: Polynomial,
  assignment: Assignment,
  p: number,
): number {
  return mod(
    poly.monomials.reduce((total, monomial) => {
      const value = Object.entries(monomial.powers).reduce(
        (product, [variable, power]) =>
          mod(product * fieldPow(assignment[variable] ?? 0, power, p), p),
        mod(monomial.coefficient, p),
      );
      return mod(total + value, p);
    }, 0),
    p,
  );
}

export function polynomialDegree(poly: Polynomial): number {
  return poly.monomials.reduce(
    (degree, monomial) =>
      Math.max(
        degree,
        Object.values(monomial.powers).reduce((sum, power) => sum + power, 0),
      ),
    0,
  );
}

export function polynomialToString(poly: Polynomial): string {
  const normalized = normalizePolynomial(poly);
  if (normalized.monomials.length === 0) return "0";

  return normalized.monomials
    .map((monomial, index) => {
      const sign = monomial.coefficient < 0 ? "-" : index === 0 ? "" : "+ ";
      const absCoefficient = Math.abs(monomial.coefficient);
      const variables = Object.entries(monomial.powers)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([variable, power]) => (power === 1 ? variable : `${variable}^${power}`));
      const coefficient =
        absCoefficient === 1 && variables.length > 0 ? "" : String(absCoefficient);
      const body = [coefficient, ...variables].filter(Boolean).join(variables.length ? "*" : "");
      return `${sign}${body}`;
    })
    .join(" ")
    .replace(/\+ -/g, "- ");
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (/\d/.test(char)) {
      let value = char;
      index += 1;
      while (index < input.length && /\d/.test(input[index])) {
        value += input[index];
        index += 1;
      }
      tokens.push({ type: "number", value });
      continue;
    }

    if (/[a-zA-Z]/.test(char)) {
      let value = char;
      index += 1;
      while (index < input.length && /[a-zA-Z0-9_]/.test(input[index])) {
        value += input[index];
        index += 1;
      }
      tokens.push({ type: "variable", value });
      continue;
    }

    if ("+-*^".includes(char)) {
      tokens.push({ type: "operator", value: char });
      index += 1;
      continue;
    }

    if (char === "(") {
      tokens.push({ type: "leftParen", value: char });
      index += 1;
      continue;
    }

    if (char === ")") {
      tokens.push({ type: "rightParen", value: char });
      index += 1;
      continue;
    }

    throw new Error(`Unexpected character: ${char}`);
  }

  return tokens;
}

class Parser {
  private position = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): Polynomial {
    const expression = this.parseExpression();
    if (this.peek()) {
      throw new Error(`Unexpected token: ${this.peek()?.value}`);
    }
    return expression;
  }

  private parseExpression(): Polynomial {
    let result = this.parseTerm();

    while (this.matchOperator("+") || this.matchOperator("-")) {
      const operator = this.previous().value;
      const right = this.parseTerm();
      result =
        operator === "+"
          ? addPolynomials(result, right)
          : subtractPolynomials(result, right);
    }

    return result;
  }

  private parseTerm(): Polynomial {
    let result = this.parsePower();

    while (this.matchOperator("*")) {
      result = multiplyPolynomials(result, this.parsePower());
    }

    return result;
  }

  private parsePower(): Polynomial {
    let result = this.parseUnary();

    while (this.matchOperator("^")) {
      const exponent = this.consume("number", "Power must be a non-negative integer.").value;
      result = powerPolynomial(result, Number(exponent));
    }

    return result;
  }

  private parseUnary(): Polynomial {
    if (this.matchOperator("+")) {
      return this.parseUnary();
    }
    if (this.matchOperator("-")) {
      return negatePolynomial(this.parseUnary());
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Polynomial {
    if (this.match("number")) {
      return constantPolynomial(Number(this.previous().value));
    }

    if (this.match("variable")) {
      return variablePolynomial(this.previous().value);
    }

    if (this.match("leftParen")) {
      const expression = this.parseExpression();
      this.consume("rightParen", "Expected ')' after expression.");
      return expression;
    }

    throw new Error(`Expected expression near '${this.peek()?.value ?? "end of input"}'.`);
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw new Error(message);
  }

  private match(type: TokenType): boolean {
    if (!this.check(type)) return false;
    this.advance();
    return true;
  }

  private matchOperator(operator: string): boolean {
    if (this.peek()?.type !== "operator" || this.peek()?.value !== operator) return false;
    this.advance();
    return true;
  }

  private check(type: TokenType): boolean {
    return this.peek()?.type === type;
  }

  private advance(): Token {
    if (this.position < this.tokens.length) this.position += 1;
    return this.previous();
  }

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private previous(): Token {
    return this.tokens[this.position - 1];
  }
}

export function parsePolynomial(input: string): Polynomial {
  return normalizePolynomial(new Parser(tokenize(input)).parse());
}

export function parseEquation(input: string): Polynomial {
  const parts = input.split("=");
  if (parts.length === 1) {
    return parsePolynomial(input);
  }
  if (parts.length !== 2) {
    throw new Error("Equation must contain at most one '=' sign.");
  }
  return subtractPolynomials(parsePolynomial(parts[0]), parsePolynomial(parts[1]));
}

export function collectVariables(polynomials: Polynomial[]): string[] {
  const variables = new Set<string>();
  for (const polynomial of polynomials) {
    for (const monomial of polynomial.monomials) {
      for (const variable of Object.keys(monomial.powers)) {
        variables.add(variable);
      }
    }
  }
  return Array.from(variables).sort((left, right) => left.localeCompare(right));
}
