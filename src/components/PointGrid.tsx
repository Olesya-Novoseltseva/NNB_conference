import { Assignment } from "../core/polynomial";
import { Point2D } from "../core/numberTheory";

type GridAssignment = Assignment | Point2D;

interface PointGridProps {
  p?: number;
  integerLimit?: number;
  solutions: GridAssignment[];
  xName?: string;
  yName?: string;
}

export function PointGrid({
  p,
  integerLimit = 6,
  solutions,
  xName = "x",
  yName = "y",
}: PointGridProps) {
  const values =
    p === undefined
      ? Array.from({ length: 2 * integerLimit + 1 }, (_, index) => index - integerLimit)
      : Array.from({ length: p }, (_, index) => index);
  const n = values.length;
  const solutionKeys = new Set(
    solutions.map((assignment) => {
      const valuesByName = assignment as Record<string, number>;
      return `${valuesByName[xName]},${valuesByName[yName]}`;
    }),
  );

  const reversedY = [...values].reverse();

  return (
    <div className="gridWrap" aria-label={`График решений: ${xName} и ${yName}`}>
      <div className="cartesianOuter">
        <div className="axisYLegend" aria-hidden="true">
          <span className="axisArrowUp">↑</span>
          <span className="axisLegendText">
            Ось ординат: <strong>{yName}</strong>
          </span>
        </div>
        <div className="cartesianBody">
          <div
            className="cartesianChart"
            style={{
              gridTemplateColumns: `2rem repeat(${n}, minmax(22px, 1fr))`,
              gridTemplateRows: `repeat(${n}, minmax(22px, 1fr)) auto`,
            }}
          >
            {reversedY.map((y, rowIndex) => (
              <div
                className="axisTick axisTickY"
                key={`y-${y}`}
                style={{ gridColumn: 1, gridRow: rowIndex + 1 }}
              >
                {y}
              </div>
            ))}

            {reversedY.flatMap((y, rowIndex) =>
              values.map((x, colIndex) => {
                const key = `${x},${y}`;
                const isSolution = solutionKeys.has(key);
                const isAxisX = y === 0;
                const isAxisY = x === 0;
                const isOrigin = isAxisX && isAxisY;
                return (
                  <div
                    className={[
                      "gridPoint",
                      isSolution ? "solution" : "",
                      isAxisX ? "axisLineX" : "",
                      isAxisY ? "axisLineY" : "",
                      isOrigin ? "axisOrigin" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={key}
                    style={{ gridColumn: colIndex + 2, gridRow: rowIndex + 1 }}
                    title={`${xName}=${x}, ${yName}=${y}`}
                  >
                    {isOrigin ? "0" : isSolution ? "•" : ""}
                  </div>
                );
              }),
            )}

            <div className="axisCorner" style={{ gridColumn: 1, gridRow: n + 1 }}>
              0
            </div>
            {values.map((x, colIndex) => (
              <div
                className="axisTick axisTickX"
                key={`x-${x}`}
                style={{ gridColumn: colIndex + 2, gridRow: n + 1 }}
              >
                {x}
              </div>
            ))}
          </div>
          <p className="axisXLegend">
            Ось абсцисс: <strong>{xName}</strong>{" "}
            <span className="axisArrow" aria-hidden="true">
              →
            </span>
          </p>
        </div>
      </div>
      <p className="muted">
        {p === undefined
          ? `Целые координаты в квадрате [${-integerLimit}…${integerLimit}] по каждой оси. Точка отмечена, если (${xName}, ${yName}) — решение.`
          : `Координаты в F_${p}: ${xName}, ${yName} ∈ {0,…,${p - 1}}. Клетка отмечена, если пара даёт решение при фиксированной проекции на первые две переменные.`}
      </p>
    </div>
  );
}
