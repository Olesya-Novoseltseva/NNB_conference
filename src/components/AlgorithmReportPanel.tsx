import { AlgorithmReport } from "../core/diophantineTypes";

const statusClass: Record<AlgorithmReport["status"], string> = {
  solved: "status good",
  "no-solution": "status bad",
  partial: "status warn",
  "not-applicable": "muted",
  "bounded-search": "status warn",
  "undecidable-general": "theorem",
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
              <span className={statusClass[r.status] ?? "muted"}>{r.status}</span>
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
