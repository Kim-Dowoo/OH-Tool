type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

export type RuntimeMode = "demo" | "local" | "supabase";
export function getRuntimeMode(): RuntimeMode { return "supabase"; }

export function assertSafeRuntime(_env: RuntimeEnvironment = process.env): void {
  void _env;
  // Supabase provides the shared runtime; Vercel must support the dynamic app.
}
