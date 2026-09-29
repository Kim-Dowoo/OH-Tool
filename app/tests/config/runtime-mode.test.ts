import { describe, expect, it } from "vitest";
import { assertSafeRuntime } from "@/lib/config/runtime-mode";

describe("runtime mode", () => {
  it("allows the dynamic Supabase application on Vercel", () => {
    expect(() => assertSafeRuntime({ VERCEL: "1" })).not.toThrow();
  });
});
