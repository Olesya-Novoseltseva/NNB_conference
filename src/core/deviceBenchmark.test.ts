import { afterEach, describe, expect, it } from "vitest";
import {
  clearDeviceBenchmarkCache,
  getCachedDeviceBenchmark,
  runIntegerAssignmentBenchmark,
} from "./deviceBenchmark";

describe("deviceBenchmark", () => {
  afterEach(() => {
    clearDeviceBenchmarkCache();
  });

  it("возвращает положительную скорость и кэширует", () => {
    const a = runIntegerAssignmentBenchmark(5000);
    expect(a.checksPerSecond).toBeGreaterThanOrEqual(1000);
    const b = runIntegerAssignmentBenchmark();
    expect(b).toEqual(a);
    expect(getCachedDeviceBenchmark()).toEqual(a);
  });
});
