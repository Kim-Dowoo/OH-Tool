export type RuntimeMode = "local" | "demo";
type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

export function getRuntimeMode(env: RuntimeEnvironment = process.env): RuntimeMode {
  return env.APP_MODE === "demo" ? "demo" : "local";
}

export function assertSafeRuntime(env: RuntimeEnvironment = process.env): void {
  if (env.VERCEL === "1" && getRuntimeMode(env) !== "demo") {
    throw new Error("Vercel에서는 APP_MODE=demo만 허용됩니다.");
  }
}
