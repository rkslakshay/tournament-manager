import { describe, expect, it } from "vitest";
import fc from "fast-check";

describe("test toolchain", () => {
  it("runs property-based tests with fast-check", () => {
    fc.assert(fc.property(fc.integer(), fc.integer(), (a, b) => a + b === b + a));
  });

  it("resolves the @ path alias", async () => {
    const mod = await import("@/engine/__tests__/toolchain.test");
    expect(mod).toBeDefined();
  });
});
