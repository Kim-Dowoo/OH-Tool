import { describe, expect, it } from "vitest";
import { assertSafeRuntime, getRuntimeMode } from "@/lib/config/runtime-mode";

describe("runtime mode", () => {
  it("defaults to local outside Vercel", () => {
    expect(getRuntimeMode({})).toBe("local");
  });

  it("rejects local mode on Vercel", () => {
    expect(() => assertSafeRuntime({ VERCEL: "1", APP_MODE: "local" })).toThrow();
  });

  it("allows demo mode on Vercel", () => {
    expect(() => assertSafeRuntime({ VERCEL: "1", APP_MODE: "demo" })).not.toThrow();
  });
});
