import { useEffect, useState } from "react";
import { GrowthMeter } from "./components/GrowthMeter";
import { AlgorithmReportPanel } from "./components/AlgorithmReportPanel";
import { Panel } from "./components/Panel";
import { isPrime } from "./core/finiteField";
import { Assignment, Polynomial, evaluateFiniteField, polynomialToString } from "./core/polynomial";
import { countFiniteFieldSearchSpace } from "./core/search";
import { analyzeDiophantineInput, DEFAULT_MODULAR_PRIMES } from "./core/diophantineAnalyzer";
import { runIntegerAssignmentBenchmark, type DeviceBenchmarkResult } from "./core/deviceBenchmark";
import type { AnalyzeOptions, DiophantineAnalysisResult } from "./core/diophantineTypes";
import { labPresets, type LabPreset } from "./data/examples";

type Screen = "map" | "lab" | "mq";

const screens: Array<{ id: Screen; label: string }> = [
  { id: "map", label: "Введение" },
  { id: "lab", label: "Диофантова лаборатория" },
  { id: "mq", label: "10-ая проблема Гильберта, NP и MQ" },
];

function formatAssignment(assignment: Assignment): string {
  return Object.entries(assignment)
    .map(([name, value]) => `${name}=${value}`)
    .join(", ");
}

interface MqRunDetail {
  runNumber: number;
  checked: number;
  found: boolean;
  truncated: boolean;
  elapsedMs: number;
  witness: Assignment | null;
  values: number[] | null;
  systemLines: string[];
}

interface MqRunResult {
  p: number;
  variables: number;
  equations: number;
  repeats: number;
  maxChecks: number;
  searchSpace: number;
  avgChecked: number;
  avgCoverage: number;
  avgTimeMs: number;
  solvedFraction: number;
  truncatedFraction: number;
  runs: MqRunDetail[];
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
): { checked: number; found: boolean; truncated: boolean; witness: Assignment | null; values: number[] | null } {
  const assignment: Assignment = {};
  let checked = 0;
  let found = false;
  let truncated = false;
  let witness: Assignment | null = null;
  let values: number[] | null = null;

  const visit = (depth: number): void => {
    if (found || truncated) return;
    if (depth === variableNames.length) {
      if (checked >= maxChecks) {
        truncated = true;
        return;
      }
      checked += 1;
      const currentValues = system.map((polynomial) => evaluateFiniteField(polynomial, assignment, p));
      const isSolution = currentValues.every((value) => value === 0);
      if (isSolution) found = true;
      if (isSolution) {
        witness = { ...assignment };
        values = currentValues;
      }
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
  return { checked, found, truncated, witness, values };
}

function runMqBenchmark(
  p: number,
  variableCount: number,
  equationCount: number,
  repeats: number,
  maxChecks: number,
): MqRunResult {
  const variableNames = Array.from({ length: variableCount }, (_, idx) => `x${idx + 1}`);
  const searchSpace = countFiniteFieldSearchSpace(variableCount, p);
  let totalChecked = 0;
  let totalTimeMs = 0;
  let solvedRuns = 0;
  let truncatedRuns = 0;
  const runs: MqRunDetail[] = [];

  for (let run = 0; run < repeats; run += 1) {
    const system = createRandomMqSystem(variableNames, equationCount, p);
    const start = performance.now();
    const result = scanExistenceBruteforce(system, variableNames, p, maxChecks);
    const end = performance.now();
    const elapsedMs = end - start;

    totalChecked += result.checked;
    totalTimeMs += elapsedMs;
    if (result.found) solvedRuns += 1;
    if (result.truncated) truncatedRuns += 1;

    runs.push({
      runNumber: run + 1,
      checked: result.checked,
      found: result.found,
      truncated: result.truncated,
      elapsedMs,
      witness: result.witness,
      values: result.values,
      systemLines: system.map((poly) => `${polynomialToString(poly)} = 0`),
    });
  }

  return {
    p,
    variables: variableCount,
    equations: equationCount,
    repeats,
    maxChecks,
    searchSpace,
    avgChecked: totalChecked / repeats,
    avgCoverage: searchSpace > 0 ? totalChecked / repeats / searchSpace : 0,
    avgTimeMs: totalTimeMs / repeats,
    solvedFraction: solvedRuns / repeats,
    truncatedFraction: truncatedRuns / repeats,
    runs,
  };
}

function App() {
  const [screen, setScreen] = useState<Screen>("map");
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
            Три вкладки: <strong>введение</strong>, затем{" "}
            <strong>«Диофантова лаборатория»</strong> — единый интерфейс для линейных
            случаев, перебора в окне по <code>Z</code> и работы над <code>F_p</code> с
            пошаговыми отчётами. Раздел про <strong>MQ</strong> — расширенный разбор
            10-ой проблемы Гильберта, связь с NP и интерактивный эксперимент с
            генерацией случайных систем. Универсального решателя для всех уравнений над{" "}
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
  const [activePresetId, setActivePresetId] = useState<string>(labPresets[0]?.id ?? "");
  const [result, setResult] = useState<DiophantineAnalysisResult | null>(null);

  useEffect(() => {
    if (useDeviceSpeed && deviceBenchmark) {
      setChecksPerSec(deviceBenchmark.checksPerSecond);
    }
  }, [deviceBenchmark, useDeviceSpeed]);

  const allEnabledFlags: AnalyzeOptions["flags"] = {
    auto: true,
    linear: true,
    univariate: true,
    modular: true,
    estimate: true,
    bounded: true,
  };

  const runAnalysisWith = (params: {
    text: string;
    domain: "Z" | "Fp";
    p: number;
    limitN: number;
    maxChecks: number;
    checksPerSecond: number;
    useDeviceSpeed: boolean;
    autoAll: boolean;
    manualFlags: {
      linear: boolean;
      univariate: boolean;
      modular: boolean;
      estimate: boolean;
      bounded: boolean;
    };
  }) => {
    const flags: AnalyzeOptions["flags"] = params.autoAll
      ? allEnabledFlags
      : {
          auto: false,
          linear: params.manualFlags.linear,
          univariate: params.manualFlags.univariate,
          modular: params.manualFlags.modular,
          estimate: params.manualFlags.estimate,
          bounded: params.manualFlags.bounded,
        };
    const effectiveCps =
      params.domain === "Z" && params.useDeviceSpeed && deviceBenchmark
        ? deviceBenchmark.checksPerSecond
        : Math.max(1, params.checksPerSecond);
    const opts: AnalyzeOptions = {
      domain: params.domain,
      p: params.p,
      limitN: params.limitN,
      checksPerSecond: effectiveCps,
      maxChecks: Math.max(100, params.maxChecks),
      modularPrimes: [...DEFAULT_MODULAR_PRIMES],
      flags,
    };
    setResult(analyzeDiophantineInput(params.text, opts));
  };

  const runAnalysis = () => {
    runAnalysisWith({
      text: systemText,
      domain,
      p: labP,
      limitN,
      maxChecks,
      checksPerSecond: checksPerSec,
      useDeviceSpeed,
      autoAll,
      manualFlags: {
        linear: fLinear,
        univariate: fUni,
        modular: fMod,
        estimate: fEst,
        bounded: fBounded,
      },
    });
  };

  const applyLabPreset = (preset: LabPreset) => {
    const presetFlags = preset.flags ?? {
      linear: true,
      univariate: true,
      modular: true,
      estimate: true,
      bounded: true,
    };
    const nextChecksPerSec = Math.max(1, preset.checksPerSecond ?? checksPerSec);

    setActivePresetId(preset.id);
    setSystemText(preset.systemText);
    setDomain(preset.domain);
    setLabP(preset.p);
    setLimitN(preset.limitN);
    setMaxChecks(preset.maxChecks);
    setAutoAll(preset.autoAll);
    setUseDeviceSpeed(preset.useDeviceSpeed);
    setChecksPerSec(nextChecksPerSec);
    setFLinear(presetFlags.linear);
    setFUni(presetFlags.univariate);
    setFMod(presetFlags.modular);
    setFEst(presetFlags.estimate);
    setFBounded(presetFlags.bounded);

    runAnalysisWith({
      text: preset.systemText,
      domain: preset.domain,
      p: preset.p,
      limitN: preset.limitN,
      maxChecks: preset.maxChecks,
      checksPerSecond: nextChecksPerSec,
      useDeviceSpeed: preset.useDeviceSpeed,
      autoAll: preset.autoAll,
      manualFlags: presetFlags,
    });
  };

  return (
    <div className="labGrid">
      <Panel
        title="Постановка и параметры"
        eyebrow="лаборатория: какой алгоритм сработал и что он доказал"
      >
        <p className="muted">
          Уравнения в формате парсера сайта: переменные, <code>+ − * ^</code>, один знак{" "}
          <code>=</code>. Несколько строк — система.
        </p>
        <div className="labPresetSection">
          <h3>Готовые примеры (автоподбор режима)</h3>
          <p className="muted">
            Выбор примера автоматически подставляет уравнение, область расчета и параметры
            запуска, затем сразу строит отчет.
          </p>
          <div className="labPresetList">
            {labPresets.map((preset) => (
              <button
                type="button"
                key={preset.id}
                className={`labPresetButton ${activePresetId === preset.id ? "active" : ""}`}
                onClick={() => applyLabPreset(preset)}
              >
                <strong>{preset.title}</strong>
                <span>{preset.description}</span>
              </button>
            ))}
          </div>
        </div>
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
        <article className="comparisonCard comparisonCardZ">
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
        <article className="comparisonCard comparisonCardFp">
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
        Дальше откройте <strong>«Диофантову лабораторию»</strong> для экспериментов по{" "}
        <code>Z</code> и <code>F_p</code>, затем раздел про 10-ую проблему Гильберта,
        NP и MQ.
      </p>
    </Panel>
  );
}

function MqScreen() {
  const [benchP, setBenchP] = useState(2);
  const [benchVariables, setBenchVariables] = useState(7);
  const [benchEquations, setBenchEquations] = useState(7);
  const [benchRepeats, setBenchRepeats] = useState(3);
  const [benchMaxChecks, setBenchMaxChecks] = useState(120000);
  const [benchmarkResult, setBenchmarkResult] = useState<MqRunResult | null>(null);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);
  const [benchmarkRunning, setBenchmarkRunning] = useState(false);
  const currentSearchSpace = countFiniteFieldSearchSpace(benchVariables, benchP);
  const safeMaxChecks = Math.max(100, benchMaxChecks);

  return (
    <div className="mqScreenGrid">
      <Panel
        title="10-ая проблема Гильберта, NP и MQ: как связаны три уровня сложности"
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

      <Panel
        title="Подробный разбор неразрешимости 10-ой проблемы Гильберта"
        eyebrow="теоремы и шаги доказательства"
      >
        <details className="collapsible" open>
          <summary>Шаг 1. Точная постановка задачи и критерий алгоритмического решения</summary>
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
              <li>
                Важно различать два режима: «поиск одного решения для конкретного
                примера» и «универсальный решатель для любого входного многочлена».
              </li>
              <li>
                Вся драматургия 10-ой проблемы Гильберта состоит в том, что второй режим
                в общем случае недостижим.
              </li>
            </ul>
          </div>
        </details>

        <details className="collapsible">
          <summary>Шаг 2. Почему «да»-ответы перечислимы: полуразрешимость</summary>
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
              <li>
                С инженерной точки зрения это похоже на бесконечный тест-ран: наличие
                контрпримера дает остановку, отсутствие контрпримера — нет гарантии
                конечного завершения.
              </li>
              <li>
                Ровно поэтому ограниченный перебор в лаборатории всегда сопровождается
                оговоркой «в окне» или «в рамках лимита проверок».
              </li>
            </ul>
          </div>
        </details>

        <details className="collapsible">
          <summary>Шаг 3. Теорема MRDP: мост между вычислимостью и диофантовыми формулами</summary>
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
              <li>
                Практический смысл: когда мы говорим «существует хитрое множество,
                которое перечислимо, но неразрешимо», MRDP говорит, что у него есть
                диофантова маска.
              </li>
              <li>
                Поэтому проблемы вычислимости нельзя изолировать от теории
                полиномиальных уравнений над целыми — это один и тот же ландшафт в
                разной записи.
              </li>
            </ul>
          </div>
        </details>

        <details className="collapsible">
          <summary>Шаг 4. Финальный вывод: почему 10-ая проблема Гильберта неразрешима</summary>
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
                Если бы 10-ая проблема Гильберта была разрешима, разрешимым было бы и это множество —
                противоречие.
              </li>
              <li>
                Следовательно, ограничение принципиальное: дело не в мощности железа, а
                в самой природе задачи.
              </li>
              <li>
                На практике это означает, что корректная стратегия — строить набор
                частных алгоритмов и точно описывать область их применимости.
              </li>
            </ul>
            <p>
              Поэтому отрицательный ответ к 10-ой проблеме Гильберта — это{" "}
              <strong>принципиальная граница алгоритмов</strong>, а не «нам пока не
              хватило мощности компьютера».
            </p>
          </div>
        </details>

        <details className="collapsible">
          <summary>Шаг 5. Связь с NP и MQ: другой тип трудности</summary>
          <div className="collapsibleBody">
            <div className="theorem">
              <h4>Важно различать</h4>
              <p>
                10-ая проблема Гильберта над <code>Z</code>: не существует универсального
                решателя (undecidable).
                <br />
                MQ/NP над конечными полями: решатель в принципе есть (перебор конечного
                множества), но при росте входа сложность может быть NP-трудной/NP-полной.
              </p>
            </div>
            <p>
              То есть речь не о противоречии, а о двух разных шкалах:{" "}
              <strong>разрешимость</strong> и <strong>асимптотическая сложность</strong>.
            </p>
            <ul className="proofList">
              <li>
                Для фиксированных <code>p</code> и <code>n</code> пространство поиска
                конечно: <code>p^n</code>.
              </li>
              <li>
                Однако уже для умеренных <code>n</code> перебор становится дорогим, что
                приводит к практической вычислительной трудности.
              </li>
              <li>
                Именно этим объясняется смысл экспериментального блока ниже: мы измеряем
                не «истину теоремы», а поведение времени на конечных входах.
              </li>
            </ul>
          </div>
        </details>
      </Panel>

      <Panel
        title="Интерактивный эксперимент MQ: генерация системы и поиск решений"
        eyebrow="эксперимент с временем, покрытием пространства и найденными свидетельствами"
      >
        <p>
          Ниже можно запустить серию случайных квадратичных систем над{" "}
          <code>F_p</code>. Алгоритм — честный перебор по <code>F_p^n</code> с лимитом
          проверок. Теперь для каждого прогона выводится сама система, статус поиска и
          найденный вектор (если он существует).
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
              Среднее покрытие пространства:{" "}
              <strong>{(benchmarkResult.avgCoverage * 100).toFixed(2)}%</strong> из{" "}
              <code>{benchmarkResult.searchSpace.toLocaleString("ru-RU")}</code>.
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

            <div className="mqRunsGrid">
              {benchmarkResult.runs.map((run) => (
                <article className="mqRunCard" key={`mq-run-${run.runNumber}`}>
                  <header>
                    <h4>Прогон #{run.runNumber}</h4>
                    <span
                      className={`reportStatusPill ${
                        run.found
                          ? "is-solved"
                          : run.truncated
                            ? "is-bounded"
                            : "is-no-solution"
                      }`}
                    >
                      {run.found ? "решение найдено" : run.truncated ? "усечен лимитом" : "решение не найдено"}
                    </span>
                  </header>
                  <p className="muted">
                    Проверено: <strong>{run.checked.toLocaleString("ru-RU")}</strong> /{" "}
                    {benchmarkResult.searchSpace.toLocaleString("ru-RU")} · время{" "}
                    <strong>{run.elapsedMs.toFixed(2)} мс</strong>
                  </p>
                  <details className="collapsible">
                    <summary>Показать сгенерированную MQ-систему</summary>
                    <div className="collapsibleBody">
                      <div className="solutionList vertical">
                        {run.systemLines.map((line, index) => (
                          <code key={`mq-eq-${run.runNumber}-${index}`}>{line}</code>
                        ))}
                      </div>
                    </div>
                  </details>
                  {run.witness ? (
                    <p className="algorithmResult">
                      <strong>Найденный вектор:</strong> <code>{formatAssignment(run.witness)}</code>
                      <br />
                      <strong>Проверка левых частей:</strong>{" "}
                      <code>{run.values?.join(", ") ?? "—"}</code>
                    </p>
                  ) : (
                    <p className="muted">
                      {run.truncated
                        ? "По этому прогону поиск остановлен лимитом проверок."
                        : "Для данного прогона корректного вектора в просмотренной области не найдено."}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </Panel>

      <Panel
        title="Динамика сложности под выбранные параметры"
        eyebrow="нижний блок связан с текущей конфигурацией эксперимента"
      >
        <GrowthMeter
          label={`Размер пространства F_${benchP}^${benchVariables}`}
          value={currentSearchSpace}
          max={Math.max(currentSearchSpace, safeMaxChecks, 1)}
        />
        <GrowthMeter
          label="Лимит проверок за запуск"
          value={safeMaxChecks}
          max={Math.max(currentSearchSpace, safeMaxChecks, 1)}
        />
        <GrowthMeter
          label="Среднее число проверенных (последний эксперимент)"
          value={Math.max(1, Math.round(benchmarkResult?.avgChecked ?? 1))}
          max={Math.max(currentSearchSpace, safeMaxChecks, 1)}
        />
        <GrowthMeter
          label="Среднее покрытие пространства (доля, %)"
          value={Math.max(1, Math.round((benchmarkResult?.avgCoverage ?? 0) * 100))}
          max={100}
        />
      </Panel>
    </div>
  );
}

export default App;
