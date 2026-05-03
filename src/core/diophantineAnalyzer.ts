import {
  collectVariables,
  parseEquation,
  polynomialDegree,
  polynomialToString,
} from "./polynomial";
import {
  AlgorithmReport,
  AnalyzeOptions,
  DiophantineAnalysisResult,
} from "./diophantineTypes";
import { extractLinearForm, trySolveLinearSystem2x2 } from "./diophantineLinearForm";
import { solveLinearDiophantineMany } from "./linearDiophantineMany";
import { solveUnivariateInteger } from "./univariateInteger";
import { findModularObstruction } from "./modularObstruction";
import {
  bruteForceFiniteField,
  bruteForceIntegerSystem,
  countIntegerSearchSpace,
} from "./search";
import { estimateSecondsForChecks, formatBigNumber, formatHumanDuration } from "./complexityEstimate";
import { isPrime } from "./finiteField";

export const DEFAULT_MODULAR_PRIMES = [2, 3, 5, 7, 11];

function rep(
  id: string,
  title: string,
  algorithmName: string,
  status: AlgorithmReport["status"],
  applicable: boolean,
  explanation: string[],
  extra?: Partial<AlgorithmReport>,
): AlgorithmReport {
  return { id, title, algorithmName, status, applicable, explanation, ...extra };
}

export function analyzeDiophantineInput(
  text: string,
  options: AnalyzeOptions,
): DiophantineAnalysisResult {
  const reports: AlgorithmReport[] = [];

  let system: ReturnType<typeof parseEquation>[];
  try {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      return {
        ok: false,
        parseError: "Введите хотя бы одно уравнение.",
        classification: "",
        variables: [],
        systemPreview: [],
        reports: [],
      };
    }
    system = lines.map(parseEquation);
  } catch (err) {
    return {
      ok: false,
      parseError: (err as Error).message,
      classification: "",
      variables: [],
      systemPreview: [],
      reports: [],
    };
  }

  const variables = collectVariables(system);
  const systemPreview = system.map((p) => `${polynomialToString(p)} = 0`);
  const maxDeg = Math.max(0, ...system.map(polynomialDegree));

  const f = options.flags;
  const runLinear = f.auto || f.linear;
  const runUni = f.auto || f.univariate;
  const runMod = f.auto || f.modular;
  const runEst = f.auto || f.estimate;
  const runBounded = f.auto || f.bounded;

  if (options.domain === "Fp") {
    if (!isPrime(options.p)) {
      return {
        ok: false,
        parseError: "В режиме F_p число p должно быть простым.",
        classification: "",
        variables,
        systemPreview,
        reports: [],
      };
    }
    const total =
      variables.length === 0 ? 1 : options.p ** variables.length;
    const search = bruteForceFiniteField(system, variables, options.p, options.maxChecks);
    reports.push(
      rep(
        "class",
        "Классификация",
        "—",
        "partial",
        true,
        [
          `Режим конечного поля F_${options.p}.`,
          `Переменные (${variables.length}): ${variables.join(", ") || "—"}.`,
          `Размер пространства: ${options.p}^${variables.length} = ${formatBigNumber(total)}.`,
        ],
      ),
    );
    reports.push(
      rep(
        "fp-search",
        "Решение перебором",
        "Полный перебор всех наборов значений из F_p",
        search.solutions.length > 0 ? "solved" : search.truncated ? "partial" : "no-solution",
        true,
        [
          `Проверено ${formatBigNumber(search.checked)} из ${formatBigNumber(search.total)} точек.`,
          search.truncated
            ? `Достигнут лимит ${options.maxChecks} проверок — перебор не завершён.`
            : "Перебор исчерпан.",
          search.solutions.length > 0
            ? `Найдено решений: ${search.solutions.length}.`
            : "Подходящих наборов не найдено.",
        ],
        {
          checked: search.checked,
          total: search.total,
          result:
            search.solutions.length > 0
              ? JSON.stringify(search.solutions.slice(0, 6))
              : search.truncated
                ? "Нет гарантированного ответа из-за усечения."
                : "Нет решений в F_p^n.",
        },
      ),
    );
    return {
      ok: true,
      classification: `Система над F_${options.p}; максимальная степень многочлена: ${maxDeg}.`,
      variables,
      systemPreview,
      reports,
    };
  }

  reports.push(
    rep(
      "class",
      "Классификация",
      "—",
      "partial",
      true,
      [
        "Режим целых чисел Z.",
        `Уравнений: ${system.length}; переменные: ${variables.join(", ") || "—"}.`,
        `Максимальная степень (по уравнениям): ${maxDeg}.`,
      ],
    ),
  );

  let linearExactHandled = false;

  if (system.length === 2 && runLinear) {
    const l1 = extractLinearForm(system[0]);
    const l2 = extractLinearForm(system[1]);
    if (l1 && l2 && l1.vars.length === 2 && l2.vars.length === 2) {
      const res = trySolveLinearSystem2x2(l1, l2);
      if (res.ok) {
        linearExactHandled = true;
        const assignStr = Object.entries(res.assignment)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ");
        reports.push(
          rep(
            "lin2",
            "Линейная система 2×2",
            "Правило Крамера (целочисленная проверка)",
            "solved",
            true,
            [
              "Обе строки линейны по двум переменным.",
              res.note ?? "",
              `Частное целочисленное решение: ${assignStr}.`,
            ].filter(Boolean),
            { result: assignStr },
          ),
        );
      } else {
        reports.push(
          rep(
            "lin2",
            "Линейная система 2×2",
            "Правило Крамера / проверка совместности",
            "no-solution",
            true,
            [res.reason],
          ),
        );
        linearExactHandled = true;
      }
    }
  }

  if (!linearExactHandled && system.length === 1 && runLinear) {
    const lf = extractLinearForm(system[0]);
    if (lf && lf.vars.length > 0) {
      linearExactHandled = true;
      const sol = solveLinearDiophantineMany(lf.coeffs, lf.rhs);
      if (sol.hasSolution) {
        const parts = lf.vars.map((vn, i) => `${vn}=${sol.particular[i]}`);
        reports.push(
          rep(
            "linN",
            "Одно линейное диофантово уравнение",
            "Рекурсия + расширенный алгоритм Евклида (много переменных)",
            "solved",
            true,
            [
              `gcd всех коэффициентов = ${sol.gcdAll}; условие делимости выполнено.`,
              `Одно целочисленное решение: ${parts.join(", ")}.`,
              lf.vars.length > 2
                ? "При более чем двух переменных существует бесконечное семейство решений; здесь показана одна точка."
                : lf.vars.length === 2
                  ? "Полное семейство integer‑решений задаётся целым параметром t (см. также вкладку с ax+by=c)."
                  : "",
            ].filter(Boolean),
            { result: parts.join(", ") },
          ),
        );
      } else {
        reports.push(
          rep(
            "linN",
            "Одно линейное диофантово уравнение",
            "Рекурсия + расширенный алгоритм Евклида",
            "no-solution",
            true,
            [sol.reason],
          ),
        );
      }
    }
  }

  if (!linearExactHandled && system.length === 1 && variables.length === 1 && runUni) {
    const v = variables[0];
    const uni = solveUnivariateInteger(system[0], v);
    const status =
      uni.explanation.some((s) => s.includes("бесконечно много")) ||
      uni.algorithmName === "Тождественный нуль"
        ? "partial"
        : uni.roots.length > 0
          ? "solved"
          : maxDeg <= 1
            ? "no-solution"
            : "partial";
    reports.push(
      rep(
        "uni",
        "Однопеременное уравнение",
        uni.algorithmName,
        status,
        true,
        uni.explanation,
        {
          result:
            uni.roots.length > 0
              ? uni.roots.sort((a, b) => a - b).join(", ")
              : "Явных целых корней не выделено.",
        },
      ),
    );
    linearExactHandled = true;
  }

  if (runMod) {
    const primes =
      options.modularPrimes.length > 0 ? options.modularPrimes : DEFAULT_MODULAR_PRIMES;
    const mod = findModularObstruction(system, variables, primes, options.maxChecks);
    if (mod.obstructingPrime !== null) {
      reports.push(
        rep(
          "mod",
          "Модульное препятствие",
          `Перебор по (Z/${mod.obstructingPrime}Z)^n`,
          "no-solution",
          true,
          [
            `Для p = ${mod.obstructingPrime} решений в кольце вычетов нет (перебор завершён полностью).`,
            "Следовательно, целочисленных решений над Z тоже не существует.",
          ],
          { result: `Нет решений mod ${mod.obstructingPrime}` },
        ),
      );
    } else {
      const lines = mod.steps.map((s) => {
        if (s.truncated && !s.solvable) {
          return `p=${s.p}: перебор усечён (${formatBigNumber(s.checked)}/${formatBigNumber(s.total)}); препятствие не доказано.`;
        }
        return `p=${s.p}: ${s.solvable ? "есть решение mod p" : "нет решений mod p"} (проверено ${formatBigNumber(s.checked)} из ${formatBigNumber(s.total)}).`;
      });
      const truncatedAny = mod.steps.some((s) => s.truncated);
      reports.push(
        rep(
          "mod",
          "Модульное препятствие",
          "Локальный перебор по простым модулям",
          truncatedAny ? "partial" : "partial",
          true,
          [
            "Если для некоторого p нет решений в (Z/pZ)^n и перебор полный, то нет и в Z^n.",
            ...lines,
            mod.obstructingPrime === null && !truncatedAny
              ? "На выбранных малых p препятствия нет (это не доказывает существование целого решения)."
              : "",
          ].filter(Boolean),
        ),
      );
    }
  }

  if (runEst && variables.length > 0) {
    const limit = Math.max(0, Math.trunc(options.limitN));
    const total = countIntegerSearchSpace(variables.length, limit);
    const sec = estimateSecondsForChecks(total, options.checksPerSecond);
    reports.push(
      rep(
        "est",
        "Оценка полного перебора в окне",
        "Подсчёт |[-N,N]|^k и экстраполяция времени",
        "partial",
        true,
        [
          `Окно: [-${limit}, ${limit}]^${variables.length}, всего ${formatBigNumber(total)} точек.`,
          `При допущении ~${options.checksPerSecond.toLocaleString("ru-RU")} проверок/сек: ${formatHumanDuration(sec)}.`,
          "Это только масштаб эксперимента; не утверждение о существовании или отсутствии решений во всём Z^n.",
        ],
        { total, checked: undefined },
      ),
    );
  }

  if (runBounded && variables.length > 0) {
    const limit = Math.max(0, Math.trunc(options.limitN));
    const total = countIntegerSearchSpace(variables.length, limit);
    const search = bruteForceIntegerSystem(system, variables, limit, options.maxChecks);
    const solText =
      search.solutions.length > 0
        ? search.solutions
            .slice(0, 12)
            .map((a) =>
              Object.entries(a)
                .map(([k, val]) => `${k}=${val}`)
                .join(", "),
            )
            .join(" | ")
        : "—";
    reports.push(
      rep(
        "bounded",
        "Ограниченный перебор по Z",
        "Исчерпывающий перебор в кубе [-N,N]^k (с лимитом шагов)",
        search.solutions.length > 0
          ? "solved"
          : search.truncated
            ? "bounded-search"
            : "partial",
        true,
        [
          `Проверено ${formatBigNumber(search.checked)} из ${formatBigNumber(search.total)} точек куба.`,
          search.truncated
            ? `Остановка по лимиту ${options.maxChecks}: ответ неполный.`
            : "Куб полностью просмотрен.",
          search.solutions.length === 0 && !search.truncated
            ? "В окне решений нет — это не доказывает отсутствие в Z."
            : "",
        ].filter(Boolean),
        {
          checked: search.checked,
          total: search.total,
          result: solText,
        },
      ),
    );
  }

  const needsH10 = !linearExactHandled && maxDeg >= 2;

  if (needsH10) {
    reports.push(
      rep(
        "h10",
        "10-я проблема Гильберта и граница алгоритмов",
        "—",
        "undecidable-general",
        true,
        [
          "Для произвольного диофантова уравнения над Z не существует универсального алгоритма «да/нет за конечное время» (отрицательное решение H10 + MRDP).",
          "Эта лаборатория применяет только конечный набор частных методов: линейные решатели, одна переменная, модульные препятствия, перебор в окне.",
          "Если задача не попала под них, корректный общий вывод здесь не выводится — только эксперимент и эвристики.",
        ],
      ),
    );
  }

  return {
    ok: true,
    classification: `Макс. степень ${maxDeg}; режим Z; распознано точных методов: ${linearExactHandled ? "да" : "нет"}.`,
    variables,
    systemPreview,
    reports,
  };
}
