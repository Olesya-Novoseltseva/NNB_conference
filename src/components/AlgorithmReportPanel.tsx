import { AlgorithmReport } from "../core/diophantineTypes";

const statusClass: Record<AlgorithmReport["status"], string> = {
  solved: "is-solved",
  "no-solution": "is-no-solution",
  partial: "is-partial",
  "not-applicable": "is-na",
  "bounded-search": "is-bounded",
  "undecidable-general": "is-theorem",
};

const statusLabel: Record<AlgorithmReport["status"], string> = {
  solved: "решено",
  "no-solution": "нет решения",
  partial: "частично",
  "not-applicable": "неприменимо",
  "bounded-search": "ограниченный поиск",
  "undecidable-general": "граница алгоритмов",
};

export function AlgorithmReportPanel({ reports }: { reports: AlgorithmReport[] }) {
  if (!reports.length) return null;

  return (
    <div className="algorithmReports">
      {reports.map((r) => (
        <article className="algorithmReportCard" key={r.id}>
          <header>
            <h3>{r.title}</h3>
            <p className="algorithmMeta">
              <span className={`reportStatusPill ${statusClass[r.status] ?? "is-na"}`}>
                {statusLabel[r.status] ?? r.status}
              </span>
              {r.applicable ? (
                <>
                  {" · "}
                  <strong>{r.algorithmName}</strong>
                </>
              ) : null}
            </p>
          </header>
          <ul className="proofList">
            {r.explanation.map((line, idx) => (
              <li key={`${r.id}-${idx}`}>{line}</li>
            ))}
          </ul>
          {r.result !== undefined && r.result !== "" ? (
            <p className="algorithmResult">
              <strong>Результат:</strong> <code>{r.result}</code>
            </p>
          ) : null}
          {r.checked !== undefined && r.total !== undefined ? (
            <p className="muted">
              Перебор: {r.checked.toLocaleString("ru-RU")} / {r.total.toLocaleString("ru-RU")}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}
