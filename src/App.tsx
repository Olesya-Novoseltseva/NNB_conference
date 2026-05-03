import { useEffect, useMemo, useState } from "react";
import { GrowthMeter } from "./components/GrowthMeter";
import { AlgorithmReportPanel } from "./components/AlgorithmReportPanel";
import { Panel } from "./components/Panel";
import { PointGrid } from "./components/PointGrid";
import { isPrime } from "./core/finiteField";
import { linearSolutionPoints, solveLinearDiophantine } from "./core/numberTheory";
import {
  Assignment,
  Polynomial,
  collectVariables,
  evaluateFiniteField,
  parseEquation,
  polynomialToString,
} from "./core/polynomial";
import {
  bruteForceFiniteField,
  bruteForceInteger,
  countFiniteFieldSearchSpace,
  countIntegerSearchSpace,
  verifyAssignment,
} from "./core/search";
import { convert3SatToMq } from "./core/satToMq";
import { analyzeDiophantineInput, DEFAULT_MODULAR_PRIMES } from "./core/diophantineAnalyzer";
import { runIntegerAssignmentBenchmark, type DeviceBenchmarkResult } from "./core/deviceBenchmark";
import type { AnalyzeOptions, DiophantineAnalysisResult } from "./core/diophantineTypes";
import {
  finiteFieldExamples,
  growthExamples,
  integerSearchExamples,
  linearExamples,
  mqExample,
} from "./data/examples";

type Screen = "map" | "integers" | "bounded" | "fields" | "mq" | "lab";

const screens: Array<{ id: Screen; label: string }> = [
  { id: "map", label: "Введение" },
  { id: "lab", label: "Диофантова лаборатория" },
  { id: "integers", label: "Линейные уравнения в целых числах" },
  { id: "bounded", label: "Перебор в ограниченном окне по Z" },
  { id: "fields", label: "Многочлены и системы над F_p" },
  { id: "mq", label: "H10, NP и задача MQ" },
];

function parseAssignment(input: string): Assignment {
  return Object.fromEntries(
    input
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, value] = part.split("=").map((item) => item.trim());
        return [name, Number(value)];
      }),
  );
}

function formatAssignment(assignment: Assignment): string {
  return Object.entries(assignment)
    .map(([name, value]) => `${name}=${value}`)
    .join(", ");
}

interface MqRunResult {
  p: number;
  variables: number;
  equations: number;
  repeats: number;
  maxChecks: number;
  avgChecked: number;
  avgTimeMs: number;
  solvedFraction: number;
  truncatedFraction: number;
}

function randomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

function createRandomMqSystem(
  variableNames: string[],
  equationCount: number,
  p: number,
): Polynomial[] {
  const system: Polynomial[] = [];

  for (let equationIndex = 0; equationIndex < equationCount; equationIndex += 1) {
    const monomials: Polynomial["monomials"] = [];

    for (let i = 0; i < variableNames.length; i += 1) {
      for (let j = i; j < variableNames.length; j += 1) {
        if (Math.random() < 0.35) {
          const coefficient = randomInt(p);
          if (coefficient !== 0) {
            const left = variableNames[i];
            const right = variableNames[j];
            monomials.push({
              coefficient,
              powers: left === right ? { [left]: 2 } : { [left]: 1, [right]: 1 },
            });
          }
        }
      }
    }

    for (const variableName of variableNames) {
      if (Math.random() < 0.45) {
        const coefficient = randomInt(p);
        if (coefficient !== 0) {
          monomials.push({ coefficient, powers: { [variableName]: 1 } });
        }
      }
    }

    const constant = randomInt(p);
    if (constant !== 0) {
      monomials.push({ coefficient: constant, powers: {} });
    }

    if (monomials.length === 0) {
      monomials.push({ coefficient: 1, powers: {} });
    }

    system.push({ monomials });
  }

  return system;
}

function scanExistenceBruteforce(
  system: Polynomial[],
  variableNames: string[],
  p: number,
  maxChecks: number,
): { checked: number; found: boolean; truncated: boolean } {
  const assignment: Assignment = {};
  let checked = 0;
  let found = false;
  let truncated = false;

  const visit = (depth: number): void => {
    if (found || truncated) return;
    if (depth === variableNames.length) {
      if (checked >= maxChecks) {
        truncated = true;
        return;
      }
      checked += 1;
      const isSolution = system.every(
        (polynomial) => evaluateFiniteField(polynomial, assignment, p) === 0,
      );
      if (isSolution) found = true;
      return;
    }

    const variableName = variableNames[depth];
    for (let value = 0; value < p; value += 1) {
      assignment[variableName] = value;
      visit(depth + 1);
      if (found || truncated) return;
    }
  };

  visit(0);
  return { checked, found, truncated };
}

function runMqBenchmark(
  p: number,
  variableCount: number,
  equationCount: number,
  repeats: number,
  maxChecks: number,
): MqRunResult {
  const variableNames = Array.from({ length: variableCount }, (_, idx) => `x${idx + 1}`);
  let totalChecked = 0;
  let totalTimeMs = 0;
  let solvedRuns = 0;
  let truncatedRuns = 0;

  for (let run = 0; run < repeats; run += 1) {
    const system = createRandomMqSystem(variableNames, equationCount, p);
    const start = performance.now();
    const result = scanExistenceBruteforce(system, variableNames, p, maxChecks);
    const end = performance.now();

    totalChecked += result.checked;
    totalTimeMs += end - start;
    if (result.found) solvedRuns += 1;
    if (result.truncated) truncatedRuns += 1;
  }

  return {
    p,
    variables: variableCount,
    equations: equationCount,
    repeats,
    maxChecks,
    avgChecked: totalChecked / repeats,
    avgTimeMs: totalTimeMs / repeats,
    solvedFraction: solvedRuns / repeats,
    truncatedFraction: truncatedRuns / repeats,
  };
}

function App() {
  const [screen, setScreen] = useState<Screen>("map");
  const [linear, setLinear] = useState(linearExamples.solvable);
  const [integerEquation, setIntegerEquation] = useState(
    integerSearchExamples.pellWindow.equation,
  );
  const [integerLimit, setIntegerLimit] = useState(integerSearchExamples.pellWindow.limit);
  const [fieldP, setFieldP] = useState(finiteFieldExamples.gf2System.p);
  const [fieldSystemText, setFieldSystemText] = useState(
    finiteFieldExamples.gf2System.equations.join("\n"),
  );
  const [witnessText, setWitnessText] = useState(
    formatAssignment(finiteFieldExamples.gf2System.witness),
  );
  const [deviceBenchmark, setDeviceBenchmark] = useState<DeviceBenchmarkResult | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setDeviceBenchmark(runIntegerAssignmentBenchmark());
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">Диофантовы уравнения и вычислительная сложность</p>
          <h1>От целых чисел к конечным полям</h1>
          <p>
            Неразрешимость диофантовых уравнений над целыми числами (10-я проблема
            Гильберта) и NP-полнота квадратичных полиномиальных систем над конечными
            полями — в одном пособии с примерами, графиками и кратким конспектом по
            теореме MRDP.
          </p>
        </div>
        <div className="heroCard">
          <strong>Как пользоваться сайтом</strong>
          <span>
            Слева по вкладкам — от простых алгоритмов над{" "}
            <code>Z</code> к перебору и системам над <code>F_p</code>. Вкладка{" "}
            <strong>«Диофантова лаборатория»</strong> строит отчёты: какой алгоритм
            применим, каков ответ или почему он неизвестен. На вкладке про MQ — конспект по
            H10, аналогии для NP и мини-пример сведения 3-SAT к квадратичной системе над{" "}
            <code>GF(2)</code>. Универсального решателя для всех уравнений над{" "}
            <code>Z</code> здесь нет и быть не может.
          </span>
        </div>
      </header>

      <nav className="tabs" aria-label="sections">
        {screens.map((item) => (
          <button
            className={screen === item.id ? "active" : ""}
            key={item.id}
            onClick={() => setScreen(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </nav>

      {screen === "map" ? <MapScreen /> : null}
      {screen === "lab" ? <DiophantineLabScreen deviceBenchmark={deviceBenchmark} /> : null}
      {screen === "integers" ? (
        <IntegerLinearScreen linear={linear} setLinear={setLinear} />
      ) : null}
      {screen === "bounded" ? (
        <BoundedSearchScreen
          equation={integerEquation}
          limit={integerLimit}
          setEquation={setIntegerEquation}
          setLimit={setIntegerLimit}
        />
      ) : null}
      {screen === "fields" ? (
        <FiniteFieldScreen
          p={fieldP}
          setP={setFieldP}
          systemText={fieldSystemText}
          setSystemText={setFieldSystemText}
          witnessText={witnessText}
          setWitnessText={setWitnessText}
        />
      ) : null}
      {screen === "mq" ? <MqScreen /> : null}
    </main>
  );
}

function DiophantineLabScreen({
  deviceBenchmark,
}: {
  deviceBenchmark: DeviceBenchmarkResult | null;
}) {
  const [systemText, setSystemText] = useState(`14*x + 21*y = 7`);
  const [domain, setDomain] = useState<"Z" | "Fp">("Z");
  const [labP, setLabP] = useState(3);
  const [limitN, setLimitN] = useState(8);
  const [checksPerSec, setChecksPerSec] = useState(500_000);
  const [useDeviceSpeed, setUseDeviceSpeed] = useState(true);
  const [maxChecks, setMaxChecks] = useState(250_000);
  const [autoAll, setAutoAll] = useState(true);
  const [fLinear, setFLinear] = useState(true);
  const [fUni, setFUni] = useState(true);
  const [fMod, setFMod] = useState(true);
  const [fEst, setFEst] = useState(true);
  const [fBounded, setFBounded] = useState(true);
  const [result, setResult] = useState<DiophantineAnalysisResult | null>(null);

  useEffect(() => {
    if (useDeviceSpeed && deviceBenchmark) {
      setChecksPerSec(deviceBenchmark.checksPerSecond);
    }
  }, [deviceBenchmark, useDeviceSpeed]);

  const runAnalysis = () => {
    const flags: AnalyzeOptions["flags"] = autoAll
      ? {
          auto: true,
          linear: true,
          univariate: true,
          modular: true,
          estimate: true,
          bounded: true,
        }
      : {
          auto: false,
          linear: fLinear,
          univariate: fUni,
          modular: fMod,
          estimate: fEst,
          bounded: fBounded,
        };
    const effectiveCps =
      domain === "Z" && useDeviceSpeed && deviceBenchmark
        ? deviceBenchmark.checksPerSecond
        : Math.max(1, checksPerSec);
    const opts: AnalyzeOptions = {
      domain,
      p: labP,
      limitN,
      checksPerSecond: effectiveCps,
      maxChecks: Math.max(100, maxChecks),
      modularPrimes: [...DEFAULT_MODULAR_PRIMES],
      flags,
    };
    setResult(analyzeDiophantineInput(systemText, opts));
  };

  return (
    <div className="labGrid">
      <Panel
        title="Постановка и параметры"
        eyebrow="лаборатория: какой алгоритм сработал и что он доказал"
      >
        <p className="muted">
          Уравнения в формате парсера сайта (см. вкладку перебора): переменные,{" "}
          <code>+ − * ^</code>, один знак <code>=</code>. Несколько строк — система.
        </p>
        <label>
          Система (строки через Enter)
          <textarea value={systemText} onChange={(e) => setSystemText(e.target.value)} />
        </label>

        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend className="muted" style={{ fontWeight: 800, marginBottom: 8 }}>
            Область
          </legend>
          <div className="checkRow">
            <label>
              <input
                type="radio"
                name="dom"
                checked={domain === "Z"}
                onChange={() => setDomain("Z")}
              />
              Целые Z
            </label>
            <label>
              <input
                type="radio"
                name="dom"
                checked={domain === "Fp"}
                onChange={() => setDomain("Fp")}
              />
              Конечное поле F_p
            </label>
          </div>
        </fieldset>

        {domain === "Fp" ? (
          <label>
            Простое p
            <input type="number" min={2} value={labP} onChange={(e) => setLabP(Number(e.target.value))} />
          </label>
        ) : null}

        {domain === "Z" ? (
          <>
            <label>
              N для окна [-N, N] (перебор и оценка)
              <input
                type="number"
                min={0}
                max={25}
                value={limitN}
                onChange={(e) => setLimitN(Number(e.target.value))}
              />
            </label>
            <p className="muted">
              {deviceBenchmark ? (
                <>
                  Калибровка устройства: ~{deviceBenchmark.checksPerSecond.toLocaleString("ru-RU")}{" "}
                  проверок/с (цикл {deviceBenchmark.durationMs.toFixed(1)} мс,{" "}
                  {deviceBenchmark.iterations.toLocaleString("ru-RU")}{" "}
                  вызовов <code>evaluateInteger</code> по двум уравнениям).
                </>
              ) : (
                <>Калибровка скорости выполняется после загрузки страницы…</>
              )}
            </p>
            <div className="checkRow">
              <label>
                <input
                  type="checkbox"
                  checked={useDeviceSpeed}
                  onChange={(e) => setUseDeviceSpeed(e.target.checked)}
                />
                Использовать скорость этого устройства для оценки времени перебора
              </label>
            </div>
            <label>
              Проверок в секунду (вручную, если снята галочка выше)
              <input
                type="number"
                min={1000}
                step={1000}
                value={checksPerSec}
                disabled={useDeviceSpeed}
                onChange={(e) => setChecksPerSec(Number(e.target.value))}
              />
            </label>
          </>
        ) : null}

        <label>
          Лимит проверок (перебор / модули)
          <input
            type="number"
            min={100}
            step={1000}
            value={maxChecks}
            onChange={(e) => setMaxChecks(Number(e.target.value))}
          />
        </label>

        <div className="checkRow">
          <label>
            <input
              type="checkbox"
              checked={autoAll}
              onChange={(e) => setAutoAll(e.target.checked)}
            />
            Авто: все методы для Z
          </label>
        </div>

        {!autoAll && domain === "Z" ? (
          <div className="checkRow">
            <label>
              <input type="checkbox" checked={fLinear} onChange={(e) => setFLinear(e.target.checked)} />
              Линейные / 2×2
            </label>
            <label>
              <input type="checkbox" checked={fUni} onChange={(e) => setFUni(e.target.checked)} />
              Одна переменная
            </label>
            <label>
              <input type="checkbox" checked={fMod} onChange={(e) => setFMod(e.target.checked)} />
              Модули
            </label>
            <label>
              <input type="checkbox" checked={fEst} onChange={(e) => setFEst(e.target.checked)} />
              Оценка окна
            </label>
            <label>
              <input type="checkbox" checked={fBounded} onChange={(e) => setFBounded(e.target.checked)} />
              Перебор в Z
            </label>
          </div>
        ) : null}

        <div className="buttonRow">
          <button type="button" onClick={runAnalysis}>
            Запустить анализ
          </button>
          <button
            type="button"
            onClick={() =>
              setSystemText(`x + y = 5\n2*x - y = 1`)
            }
          >
            Пример 2×2
          </button>
          <button
            type="button"
            onClick={() => setSystemText(`x^2 - 5*x + 6 = 0`)}
          >
            Пример квадратное
          </button>
          <button
            type="button"
            onClick={() => setSystemText(`2*x + 1 = 0`)}
          >
            Пример (модуль 2)
          </button>
        </div>
      </Panel>

      <Panel title="Результаты анализа" eyebrow="отчёты по шагам">
        {!result ? (
          <p className="muted">Нажмите «Запустить анализ», чтобы построить отчёты.</p>
        ) : null}
        {result?.parseError ? <p className="status bad">{result.parseError}</p> : null}
        {result?.ok ? (
          <>
            <p className="formula">{result.classification}</p>
            <p className="muted">Система: {result.systemPreview.join(" ; ")}</p>
            <AlgorithmReportPanel reports={result.reports} />
          </>
        ) : null}
      </Panel>
    </div>
  );
}

function MapScreen() {
  return (
    <Panel title="Две разные математические ситуации" eyebrow="с чего начать">
      <div className="comparison">
        <article>
          <h3>Целые числа Z</h3>
          <p>
            Для произвольного многочлена с целыми коэффициентами <strong>не существует</strong>{" "}
            общего алгоритма, который по всем входам за конечное время отвечает, есть ли
            целочисленное решение — это и есть отрицательное решение 10-й проблемы
            Гильберта. Здесь вы увидите лишь <strong>частные методы</strong> (линейный случай) и{" "}
            <strong>ограниченный перебор</strong> в квадрате [-N, N]<sup>k</sup>: это не
            замена теореме.
          </p>
        </article>
        <article>
          <h3>Конечное поле F_p</h3>
          <p>
            Всего <code>p<sup>n</sup></code> наборов значений переменных, поэтому вопрос
            «есть ли корень у системы» <strong>всегда разрешим перебором</strong> в
            принципе. Другое дело — <strong>время</strong>: при росте числа переменных
            перебор становится нереалистичным; для квадратичных систем (задача{" "}
            <strong>MQ</strong>) в типичной постановке возникает класс{" "}
            <strong>NP</strong>: ответ легко проверить по готовому вектору, но найти его
            может быть очень трудно.
          </p>
        </article>
      </div>
      <p className="muted" style={{ marginTop: 16 }}>
        Переключайте вкладки выше: от линейных уравнений и перебора к полю{" "}
        <code>F_p</code> и разделу про H10, NP и MQ.
      </p>
    </Panel>
  );
}

function IntegerLinearScreen({
  linear,
  setLinear,
}: {
  linear: { a: number; b: number; c: number; label: string };
  setLinear: (value: { a: number; b: number; c: number; label: string }) => void;
}) {
  const result = useMemo(
    () => solveLinearDiophantine(linear.a, linear.b, linear.c),
    [linear],
  );
  const points = useMemo(
    () => linearSolutionPoints(linear.a, linear.b, linear.c, 8),
    [linear],
  );

  return (
    <div className="twoColumn">
      <Panel title="Ввод коэффициентов a·x + b·y = c" eyebrow="евклид и целые решения">
        <div className="controls three">
          <label>
            a
            <input
              type="number"
              value={linear.a}
              onChange={(event) =>
                setLinear({ ...linear, a: Number(event.target.value), label: "custom" })
              }
            />
          </label>
          <label>
            b
            <input
              type="number"
              value={linear.b}
              onChange={(event) =>
                setLinear({ ...linear, b: Number(event.target.value), label: "custom" })
              }
            />
          </label>
          <label>
            c
            <input
              type="number"
              value={linear.c}
              onChange={(event) =>
                setLinear({ ...linear, c: Number(event.target.value), label: "custom" })
              }
            />
          </label>
        </div>
        <div className="buttonRow">
          <button type="button" onClick={() => setLinear(linearExamples.solvable)}>
            Пример с решением
          </button>
          <button type="button" onClick={() => setLinear(linearExamples.unsolvable)}>
            Пример без решения
          </button>
        </div>
        <p className="formula">
          {linear.a}x + {linear.b}y = {linear.c}
        </p>
      </Panel>

      <Panel title="Решение и множество точек на плоскости (x, y)" eyebrow="алгоритм Евклида">
        {result.hasSolution ? (
          <>
            <p className="status good">Решения существуют, потому что gcd делит c.</p>
            <p>
              gcd = <strong>{result.gcd}</strong>, частное решение:{" "}
              <strong>
                x0={result.x0}, y0={result.y0}
              </strong>
            </p>
            <p className="formula">
              x = {result.x0} + ({result.stepX})t, y = {result.y0} + ({result.stepY})t
            </p>
          </>
        ) : (
          <p className="status bad">{result.reason}</p>
        )}
        <PointGrid solutions={points} integerLimit={8} />
      </Panel>
    </div>
  );
}

function BoundedSearchScreen({
  equation,
  limit,
  setEquation,
  setLimit,
}: {
  equation: string;
  limit: number;
  setEquation: (value: string) => void;
  setLimit: (value: number) => void;
}) {
  const parsed = useMemo(() => {
    try {
      const polynomial = parseEquation(equation);
      const variables = collectVariables([polynomial]);
      return { ok: true as const, polynomial, variables };
    } catch (error) {
      return { ok: false as const, error: (error as Error).message };
    }
  }, [equation]);

  const result = useMemo(() => {
    if (!parsed.ok) return undefined;
    return bruteForceInteger(parsed.polynomial, parsed.variables, limit);
  }, [parsed, limit]);

  return (
    <div className="twoColumn">
      <Panel title="Уравнение и граница окна перебора" eyebrow="только выбранный куб [-N, N]^k">
        <label>
          Уравнение
          <textarea value={equation} onChange={(event) => setEquation(event.target.value)} />
        </label>
        <label>
          Граница N для [-N, N]^k
          <input
            type="number"
            min={0}
            max={20}
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setEquation(integerSearchExamples.pellWindow.equation);
            setLimit(integerSearchExamples.pellWindow.limit);
          }}
        >
          Загрузить пример Пелля
        </button>
      </Panel>

      <Panel title="Результаты перебора" eyebrow="не путать с общей разрешимостью">
        {!parsed.ok ? <p className="status bad">{parsed.error}</p> : null}
        {parsed.ok && result ? (
          <>
            <p>
              Переменные: <strong>{parsed.variables.join(", ") || "нет"}</strong>
            </p>
            <p>
              Проверено {result.checked.toLocaleString("ru-RU")} из{" "}
              {countIntegerSearchSpace(parsed.variables.length, limit).toLocaleString("ru-RU")}{" "}
              точек.
            </p>
            <p className="status warn">
              Если решений не найдено, это означает только «не найдено в выбранном окне».
            </p>
            <div className="solutionList">
              {result.solutions.slice(0, 24).map((solution) => (
                <code key={formatAssignment(solution)}>{formatAssignment(solution)}</code>
              ))}
            </div>
          </>
        ) : null}
      </Panel>
    </div>
  );
}

function FiniteFieldScreen({
  p,
  setP,
  systemText,
  setSystemText,
  witnessText,
  setWitnessText,
}: {
  p: number;
  setP: (value: number) => void;
  systemText: string;
  setSystemText: (value: string) => void;
  witnessText: string;
  setWitnessText: (value: string) => void;
}) {
  const parsed = useMemo(() => {
    try {
      const system = systemText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map(parseEquation);
      return { ok: true as const, system, variables: collectVariables(system) };
    } catch (error) {
      return { ok: false as const, error: (error as Error).message };
    }
  }, [systemText]);
  const witness = useMemo(() => parseAssignment(witnessText), [witnessText]);
  const search = useMemo(() => {
    if (!parsed.ok || !isPrime(p)) return undefined;
    return bruteForceFiniteField(parsed.system, parsed.variables, p);
  }, [parsed, p]);
  const verification = useMemo(() => {
    if (!parsed.ok || !isPrime(p)) return undefined;
    return verifyAssignment(parsed.system, witness, p);
  }, [parsed, witness, p]);

  return (
    <div className="twoColumn">
      <Panel title="Поле, система и кандидат на решение" eyebrow="простое p и свидетельство">
        <label>
          Простое p
          <input type="number" min={2} value={p} onChange={(event) => setP(Number(event.target.value))} />
        </label>
        <label>
          Уравнения, по одному в строке
          <textarea value={systemText} onChange={(event) => setSystemText(event.target.value)} />
        </label>
        <label>
          Свидетельство
          <input value={witnessText} onChange={(event) => setWitnessText(event.target.value)} />
        </label>
        <button
          type="button"
          onClick={() => {
            setP(finiteFieldExamples.gf2System.p);
            setSystemText(finiteFieldExamples.gf2System.equations.join("\n"));
            setWitnessText(formatAssignment(finiteFieldExamples.gf2System.witness));
          }}
        >
          Загрузить пример над F_2
        </button>
      </Panel>

      <Panel title="Размер пространства, проверка свидетельства и поиск" eyebrow="перебор всех векторов из F_p^n">
        {!isPrime(p) ? <p className="status bad">p должно быть простым числом.</p> : null}
        {!parsed.ok ? <p className="status bad">{parsed.error}</p> : null}
        {parsed.ok && search && verification ? (
          <>
            <p>
              Пространство поиска:{" "}
              <strong>
                {p}^{parsed.variables.length} ={" "}
                {countFiniteFieldSearchSpace(parsed.variables.length, p).toLocaleString("ru-RU")}
              </strong>
            </p>
            <p className={verification.isSolution ? "status good" : "status warn"}>
              Свидетельство {verification.isSolution ? "подходит" : "не подходит"}; значения
              уравнений: {verification.values.join(", ")}
            </p>
            <p>Найдено решений: {search.solutions.length}</p>
            <div className="solutionList">
              {search.solutions.slice(0, 24).map((solution) => (
                <code key={formatAssignment(solution)}>{formatAssignment(solution)}</code>
              ))}
            </div>
            {parsed.variables.length === 2 ? (
              <PointGrid
                p={p}
                solutions={search.solutions}
                xName={parsed.variables[0]}
                yName={parsed.variables[1]}
              />
            ) : parsed.variables.length > 2 ? (
              <p className="muted">
                График на плоскости строится только при <strong>ровно двух</strong>{" "}
                переменных (оси — первая и вторая в лексикографическом порядке). При{" "}
                {parsed.variables.length} переменных это уже не полная картина, поэтому
                сетку мы не показываем; смотрите список векторов-решений выше.
              </p>
            ) : null}
          </>
        ) : null}
      </Panel>
    </div>
  );
}

function MqScreen() {
  const mq = useMemo(() => convert3SatToMq(mqExample.clauses), []);
  const verification = useMemo(
    () => verifyAssignment(mq.system, mqExample.satisfyingWitness, 2),
    [mq],
  );
  const [benchP, setBenchP] = useState(2);
  const [benchVariables, setBenchVariables] = useState(7);
  const [benchEquations, setBenchEquations] = useState(7);
  const [benchRepeats, setBenchRepeats] = useState(3);
  const [benchMaxChecks, setBenchMaxChecks] = useState(120000);
  const [benchmarkResult, setBenchmarkResult] = useState<MqRunResult | null>(null);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);
  const [benchmarkRunning, setBenchmarkRunning] = useState(false);

  return (
    <div className="mqScreenGrid">
      <Panel
        title="H10, NP и MQ: как связаны три уровня сложности"
        eyebrow="неразрешимость, проверяемость, практический перебор"
      >
        <p>
          Этот раздел устроен как мини-учебник: сначала — строгое содержание 10-й
          проблемы Гильберта и цепочка идей, ведущая к неразрешимости; затем — связь с
          классом NP и задачей MQ; в конце — интерактивный запуск, который показывает,
          как растет время поиска в зависимости от размеров входа.
        </p>
        <p>
          Для честности: в веб-формате мы даем подробный <em>учебный разбор доказательной
          схемы</em> (теоремы + логические шаги + почему следствие верно), а не полный
          текст оригинальных статей на десятки страниц.
        </p>
      </Panel>

      <Panel title="Подробный разбор неразрешимости H10" eyebrow="теоремы и шаги доказательства">
        <details className="collapsible" open>
          <summary>Шаг 1. Точная постановка H10 и что требуется от алгоритма</summary>
          <div className="collapsibleBody">
            <div className="theorem">
              <h4>Формулировка задачи</h4>
              <p>
                Для многочлена <code>P(x₁,...,xₙ) ∈ Z[x₁,...,xₙ]</code> требуется
                алгоритм, который всегда останавливается и отвечает, существует ли
                целочисленный корень: <code>∃a₁,...,aₙ ∈ Z : P(a₁,...,aₙ)=0</code>.
              </p>
            </div>
            <ul className="proofList">
              <li>
                Слово «алгоритм» здесь означает единый механический процесс для{" "}
                <strong>всех</strong> входов.
              </li>
              <li>
                Процесс должен возвращать ответ «да/нет» за конечное время на каждом
                входе, а не только иногда.
              </li>
              <li>
                Именно это свойство делает задачу задачей разрешимости, а не просто
                поиском примеров.
              </li>
            </ul>
          </div>
        </details>

        <details className="collapsible">
          <summary>Шаг 2. Полуразрешимость диофантовых уравнений</summary>
          <div className="collapsibleBody">
            <div className="theorem">
              <h4>Лемма (полуразрешимость)</h4>
              <p>
                Если уравнение имеет решение, можно его найти перебором всех кортежей
                целых чисел: рано или поздно правильный кортеж встретится.
              </p>
            </div>
            <ul className="proofList">
              <li>
                Перебор кортежей <code>Zⁿ</code> можно организовать в вычислимо
                нумерованную последовательность.
              </li>
              <li>
                Проверка каждого конкретного кортежа конечна (подстановка в многочлен и
                сравнение с нулем).
              </li>
              <li>
                Если решения нет, этот процесс не обязан остановиться. Значит это
                полуразрешимость, но не полная разрешимость.
              </li>
            </ul>
          </div>
        </details>

        <details className="collapsible">
          <summary>Шаг 3. Теорема MRDP и ключевая мостовая идея</summary>
          <div className="collapsibleBody">
            <div className="theorem">
              <h4>Теорема MRDP (Davis–Putnam–Robinson–Matiyasevich)</h4>
              <p>
                Класс диофантовых множеств совпадает с классом рекурсивно перечислимых
                множеств.
              </p>
            </div>
            <ul className="proofList">
              <li>
                «Диофантово ⇒ перечислимо»: кандидаты на решение можно перечислять и
                проверять.
              </li>
              <li>
                «Перечислимо ⇒ диофантово»: каждый алгоритмический процесс перечисления
                кодируется полиномиальными условиями (глубокая часть, завершенная
                Матиясевичем).
              </li>
              <li>
                Следствие: вопросы о вычислимости множеств переносятся в язык
                диофантовых уравнений.
              </li>
            </ul>
          </div>
        </details>

        <details className="collapsible">
          <summary>Шаг 4. Финал: почему H10 неразрешима</summary>
          <div className="collapsibleBody">
            <div className="theorem">
              <h4>Следствие</h4>
              <p>
                Не существует общего алгоритма, решающего для любого диофантова уравнения
                над <code>Z</code>, имеет ли оно решение.
              </p>
            </div>
            <ul className="proofList">
              <li>
                Существуют перечислимые, но неразрешимые множества (классический источник
                — проблема остановки).
              </li>
              <li>
                По MRDP такое множество имеет диофантово представление.
              </li>
              <li>
                Если бы H10 была разрешима, разрешимым было бы и это множество —
                противоречие.
              </li>
            </ul>
            <p>
              Поэтому отрицательный ответ к H10 — это <strong>принципиальная граница
              алгоритмов</strong>, а не «нам пока не хватило мощности компьютера».
            </p>
          </div>
        </details>

        <details className="collapsible">
          <summary>Связь с NP и MQ: почему это другой тип трудности</summary>
          <div className="collapsibleBody">
            <div className="theorem">
              <h4>Важно различать</h4>
              <p>
                H10 над <code>Z</code>: не существует универсального решателя (undecidable).
                <br />
                MQ/NP над конечными полями: решатель в принципе есть (перебор конечного
                множества), но при росте входа сложность может быть NP-трудной/NP-полной.
              </p>
            </div>
            <p>
              То есть речь не о противоречии, а о двух разных шкалах:{" "}
              <strong>разрешимость</strong> и <strong>асимптотическая сложность</strong>.
            </p>
          </div>
        </details>
      </Panel>

      <Panel title="Наглядные (физические) аналогии для понимания" eyebrow="почему интуиция работает">
        <div className="analogyCard">
          <h4>H10: библиотека бесконечных механических головоломок</h4>
          <p>
            Представьте библиотеку из бесконечного числа коробок с механическими
            головоломками одного <em>типа</em> (многочлен — коробка), но с разными
            настройками. Вопрос: «в каждой ли коробке есть хотя бы одно правильное
            положение деталей?» Отрицательное решение H10 означает:{" "}
            <strong>не существует одной инструкции</strong>, по которой вы за конечное
            время гарантированно получите «да/нет» для <em>любой</em> коробки. Это не
            значит, что отдельные коробки неразрешимы — отдельные случаи разбираются
            частными методами (как линейный блок на этом сайте).
          </p>
        </div>

        <div className="analogyCard">
          <h4>NP: быстро проверить пропуск, трудно подобрать все коды</h4>
          <p>
            <strong>Проверка свидетельства:</strong> пассажир показывает билет — контролёр
            за пару секунд подтверждает «билет действителен по правилам». Это похоже на
            подстановку вектора в многочлены над <code>F_p</code>: несколько арифметических
            операций по модулю.
          </p>
          <p>
            <strong>Поиск решения:</strong> если билета нет, но нужно «найти правильный
            набор полей в вагоне», при экспоненциально большом числе комбинаций это уже
            экспедиция. Для NP-трудных семейств мы не знаем универсального быстрого
            поиска, но знаем быструю <em>верификацию</em> кандидата — как на вкладке с{" "}
            <code>F_p</code>.
          </p>
        </div>

        <div className="analogyCard">
          <h4>MQ: система механических замков с взаимными ограничениями</h4>
          <p>
            Квадратичные члены <code>xᵢxⱼ</code> похожи на то, что два выбора должны{" "}
            <strong>согласоваться</strong>: положение одного диска влияет на допустимость
            другого. Система MQ задаёт несколько таких «замков» сразу; подобрать все
            коды с нуля может быть тяжело, но <strong>выставили код — проверить защёлки</strong>{" "}
            (подставить в уравнения) быстро.
          </p>
          <p>
            Связь с H10: сами по себе это <strong>разные миры</strong> — над{" "}
            <code>Z</code> нет общего разрешателя существования корня, над{" "}
            <code>F_pⁿ</code> с фиксированным <code>p</code> и <code>n</code> вопрос
            конечен. NP-полнота MQ описывает <strong>рост сложности при больших входах</strong>,
            а не «неразрешимость в смысле Тьюринга» на конечном поле.
          </p>
        </div>
      </Panel>

      <Panel title="Практика 1: мини-сведение 3-SAT → MQ над GF(2)" eyebrow="что именно можно запустить и проверить">
        <p>
          Булевы переменные кодируются как <code>0</code> или <code>1</code> в{" "}
          <code>GF(2)</code>. Литерал «не <code>x</code>» записывается как{" "}
          <code>1 + x</code>. Дизъюнкт ложен, если ложны все три литерала; их «ложность»
          перемножается — получается степень до трёх, поэтому вводится вспомогательная
          переменная <code>yᵢ</code>, чтобы оставить только <strong>квадратичные</strong>{" "}
          ограничения (схема MQ).
        </p>
        <div className="steps">
          {mq.steps.map((step) => (
            <article key={step.title}>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
            </article>
          ))}
        </div>
        <h3>Система (каждая строка = 0 в GF(2))</h3>
        <div className="solutionList vertical">
          {mq.system.map((polynomial, index) => (
            <code key={`${polynomialToString(polynomial)}-${index}`}>
              {polynomialToString(polynomial)} = 0
            </code>
          ))}
        </div>
        <p>
          <strong>Свидетельство (вектор, который нужно только проверить):</strong>{" "}
          <code>{formatAssignment(mqExample.satisfyingWitness)}</code>
        </p>
        <p className={verification.isSolution ? "status good" : "status bad"}>
          Значения левых частей после подстановки: {verification.values.join(", ")}.{" "}
          {verification.isSolution
            ? "Все обнулись в GF(2) — кандидат действительно удовлетворяет системе."
            : "Есть ненулевой остаток — кандидат не решение."}
        </p>
      </Panel>

      <Panel title="Практика 2: запуск случайной MQ-задачи и измерение сложности" eyebrow="эксперимент с временем и числом проверок">
        <p>
          Ниже можно запустить серию случайных квадратичных систем над{" "}
          <code>F_p</code>. Алгоритм — честный перебор по <code>F_p^n</code> с лимитом
          проверок. Это демонстрирует, как быстро растут затраты даже в конечном поле.
        </p>
        <div className="benchmarkGrid">
          <label>
            p (простое)
            <input
              type="number"
              min={2}
              max={11}
              value={benchP}
              onChange={(event) => setBenchP(Number(event.target.value))}
            />
          </label>
          <label>
            n переменных
            <input
              type="number"
              min={2}
              max={9}
              value={benchVariables}
              onChange={(event) => setBenchVariables(Number(event.target.value))}
            />
          </label>
          <label>
            m уравнений
            <input
              type="number"
              min={1}
              max={12}
              value={benchEquations}
              onChange={(event) => setBenchEquations(Number(event.target.value))}
            />
          </label>
          <label>
            Повторов
            <input
              type="number"
              min={1}
              max={10}
              value={benchRepeats}
              onChange={(event) => setBenchRepeats(Number(event.target.value))}
            />
          </label>
        </div>
        <label>
          Максимум проверяемых векторов за один запуск
          <input
            type="number"
            min={100}
            step={100}
            value={benchMaxChecks}
            onChange={(event) => setBenchMaxChecks(Number(event.target.value))}
          />
        </label>
        <div className="buttonRow">
          <button
            type="button"
            disabled={benchmarkRunning}
            onClick={() => {
              setBenchmarkError(null);
              setBenchmarkResult(null);

              if (!isPrime(benchP)) {
                setBenchmarkError("p должно быть простым числом (например: 2, 3, 5, 7).");
                return;
              }
              if (benchVariables < 2 || benchEquations < 1 || benchRepeats < 1) {
                setBenchmarkError("Проверьте диапазоны: n>=2, m>=1, повторов>=1.");
                return;
              }
              if (benchMaxChecks < 100) {
                setBenchmarkError("Лимит проверок должен быть не меньше 100.");
                return;
              }

              setBenchmarkRunning(true);
              try {
                const result = runMqBenchmark(
                  benchP,
                  benchVariables,
                  benchEquations,
                  benchRepeats,
                  benchMaxChecks,
                );
                setBenchmarkResult(result);
              } catch {
                setBenchmarkError("Не удалось выполнить эксперимент. Попробуйте меньшие n и m.");
              } finally {
                setBenchmarkRunning(false);
              }
            }}
          >
            {benchmarkRunning ? "Идет запуск..." : "Запустить MQ-эксперимент"}
          </button>
        </div>
        {benchmarkError ? <p className="status bad">{benchmarkError}</p> : null}
        {benchmarkResult ? (
          <div className="benchmarkResult">
            <p>
              Конфигурация: <strong>p={benchmarkResult.p}</strong>,{" "}
              <strong>n={benchmarkResult.variables}</strong>,{" "}
              <strong>m={benchmarkResult.equations}</strong>, повторов:{" "}
              <strong>{benchmarkResult.repeats}</strong>.
            </p>
            <p>
              Среднее число проверенных векторов:{" "}
              <strong>{Math.round(benchmarkResult.avgChecked).toLocaleString("ru-RU")}</strong>.
            </p>
            <p>
              Среднее время на запуск:{" "}
              <strong>{benchmarkResult.avgTimeMs.toFixed(2)} мс</strong>.
            </p>
            <p>
              Доля запусков, где найдено решение:{" "}
              <strong>{(benchmarkResult.solvedFraction * 100).toFixed(1)}%</strong>.
            </p>
            <p>
              Доля усеченных запусков по лимиту:{" "}
              <strong>{(benchmarkResult.truncatedFraction * 100).toFixed(1)}%</strong>.
            </p>
            <p className="muted">
              Интерпретация: даже когда поле конечно, рост <code>p^n</code> быстро
              делает полный поиск тяжелым. Это и есть практическая мотивация сложности
              для MQ/NP-постановок.
            </p>
          </div>
        ) : null}
      </Panel>

      <Panel title="Как быстро растёт полный перебор по F_p^n" eyebrow="почему «конечно» ≠ «быстро»">
        {growthExamples.map((item) => (
          <GrowthMeter
            key={item.label}
            label={item.label}
            value={countFiniteFieldSearchSpace(item.variables, item.p)}
            max={countFiniteFieldSearchSpace(20, 2)}
          />
        ))}
      </Panel>
    </div>
  );
}

export default App;
