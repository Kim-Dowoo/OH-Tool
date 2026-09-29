import { assertSafeRuntime, getRuntimeMode } from "@/lib/config/runtime-mode";
import { createDemoRepository } from "./demo-repository";
import type { OhRepository } from "./contracts";

let localRepository: Promise<OhRepository> | undefined;

export async function getRepository(): Promise<OhRepository> {
  assertSafeRuntime();
  if (getRuntimeMode() === "demo") return createDemoRepository();
  localRepository ??= (async () => {
    const [{ createLocalRepository }, { openDatabase }, { runMigrations }] = await Promise.all([
      import("./local-repository"), import("@/lib/db/client"), import("@/lib/db/migrations"),
    ]);
    const db = openDatabase();
    try { runMigrations(db); return createLocalRepository(db); }
    catch (error) { db.close(); throw error; }
  })().catch((error) => { localRepository = undefined; throw error; });
  return localRepository;
}
