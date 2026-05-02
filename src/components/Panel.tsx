import { ReactNode } from "react";

interface PanelProps {
  title: string;
  eyebrow?: string;
  children: ReactNode;
}

export function Panel({ title, eyebrow, children }: PanelProps) {
  return (
    <section className="panel">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2>{title}</h2>
      {children}
    </section>
  );
}
