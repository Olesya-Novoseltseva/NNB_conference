import {
  Polynomial,
  addPolynomials,
  constantPolynomial,
  multiplyPolynomials,
  subtractPolynomials,
  variablePolynomial,
} from "./polynomial";

export interface Literal {
  variable: string;
  negated: boolean;
}

export type Clause = [Literal, Literal, Literal];

export interface SatToMqStep {
  title: string;
  detail: string;
}

export interface SatToMqResult {
  system: Polynomial[];
  variables: string[];
  auxiliaryVariables: string[];
  steps: SatToMqStep[];
}

export function literal(name: string): Literal {
  return { variable: name, negated: false };
}

export function not(name: string): Literal {
  return { variable: name, negated: true };
}

function literalPolynomial(item: Literal): Polynomial {
  const variable = variablePolynomial(item.variable);
  return item.negated ? addPolynomials(constantPolynomial(1), variable) : variable;
}

function falseExpression(item: Literal): Polynomial {
  return addPolynomials(constantPolynomial(1), literalPolynomial(item));
}

export function convert3SatToMq(clauses: Clause[]): SatToMqResult {
  const system: Polynomial[] = [];
  const variables = new Set<string>();
  const auxiliaryVariables: string[] = [];
  const steps: SatToMqStep[] = [
    {
      title: "Булевы значения как элементы GF(2)",
      detail: "0 означает false, 1 означает true, а отрицание литерала x записывается как 1 + x.",
    },
  ];

  clauses.forEach((clause, index) => {
    clause.forEach((item) => variables.add(item.variable));

    const [firstFalse, secondFalse, thirdFalse] = clause.map(falseExpression);
    const helperName = `y${index + 1}`;
    auxiliaryVariables.push(helperName);

    const helper = variablePolynomial(helperName);
    const productOfFirstTwo = multiplyPolynomials(firstFalse, secondFalse);
    const firstQuadratic = subtractPolynomials(helper, productOfFirstTwo);
    const secondQuadratic = multiplyPolynomials(helper, thirdFalse);

    system.push(firstQuadratic, secondQuadratic);
    steps.push({
      title: `Дизъюнкт ${index + 1}`,
      detail:
        "Клауза истинна, если не все три литерала ложны. В GF(2) это кодируется через произведение выражений ложности; кубический член разбивается новой переменной.",
    });
  });

  return {
    system,
    variables: [...Array.from(variables).sort(), ...auxiliaryVariables],
    auxiliaryVariables,
    steps,
  };
}

export const demoClauses: Clause[] = [
  [literal("x1"), not("x2"), literal("x3")],
  [not("x1"), literal("x2"), literal("x3")],
];
