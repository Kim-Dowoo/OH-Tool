type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

export function assertSafeRuntime(_env: RuntimeEnvironment = process.env): void {
  // Supabase provides the shared runtime; Vercel must support the dynamic app.
}
