import { describe, expect, it } from "vitest";
import { analyzeDiophantineInput } from "./diophantineAnalyzer";

const baseFlags = {
  auto: true,
  linear: true,
  univariate: true,
  modular: true,
  estimate: true,
  bounded: true,
};

describe("analyzeDiophantineInput", () => {
  it("линейное 14x+21y=7 над Z", () => {
    const r = analyzeDiophantineInput("14*x + 21*y = 7", {
      domain: "Z",
      p: 3,
      limitN: 3,
      checksPerSecond: 1e6,
      maxChecks: 50_000,
      modularPrimes: [2, 3],
      flags: baseFlags,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const lin = r.reports.find((x) => x.id === "linN");
    expect(lin?.status).toBe("solved");
  });

  it("модульное препятствие для 2x+1=0 (нет решений mod 2)", () => {
    const r = analyzeDiophantineInput("2*x + 1 = 0", {
      domain: "Z",
      p: 3,
      limitN: 2,
      checksPerSecond: 1e6,
      maxChecks: 200_000,
      modularPrimes: [2],
      flags: { ...baseFlags, bounded: false },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const mod = r.reports.find((x) => x.id === "mod");
    expect(mod?.status).toBe("no-solution");
  });

  it("режим F_p", () => {
    const r = analyzeDiophantineInput("x + 1 = 0", {
      domain: "Fp",
      p: 2,
      limitN: 0,
      checksPerSecond: 1e6,
      maxChecks: 100,
      modularPrimes: [],
      flags: baseFlags,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const fp = r.reports.find((x) => x.id === "fp-search");
    expect(fp?.status).toBe("solved");
  });
});
