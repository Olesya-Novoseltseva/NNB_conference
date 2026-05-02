import { describe, expect, it } from "vitest";
import { verifyAssignment } from "./search";
import { convert3SatToMq, demoClauses } from "./satToMq";

describe("3-SAT to MQ demo", () => {
  it("turns the demo formula into a satisfied MQ system over GF(2)", () => {
    const result = convert3SatToMq(demoClauses);
    const verification = verifyAssignment(
      result.system,
      { x1: 1, x2: 0, x3: 1, y1: 0, y2: 1 },
      2,
    );

    expect(result.system).toHaveLength(4);
    expect(verification.isSolution).toBe(true);
  });
});
