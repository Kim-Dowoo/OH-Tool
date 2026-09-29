import { afterEach, expect, it, vi } from "vitest";

// Importing either local module is itself a forbidden side effect in demo mode.
vi.mock("@/lib/repositories/local-repository", () => { throw new Error("Local repository imported in demo"); });
vi.mock("@/lib/db/client", () => { throw new Error("SQLite imported in demo"); });

afterEach(() => vi.unstubAllEnvs());

it("selects the demo repository without loading local modules on Vercel", async () => {
  vi.stubEnv("APP_MODE", "demo");
  vi.stubEnv("VERCEL", "1");
  const { getRepository } = await import("@/lib/repositories/get-repository");
  expect(await (await getRepository()).getDashboard({})).toMatchObject({ totalRequested: 42 });
});

it("rejects unsafe Vercel configuration before selecting any repository", async () => {
  vi.stubEnv("APP_MODE", "local");
  vi.stubEnv("VERCEL", "1");
  const { getRepository } = await import("@/lib/repositories/get-repository");
  await expect(getRepository()).rejects.toThrow("Vercel에서는 APP_MODE=demo만 허용됩니다.");
});
