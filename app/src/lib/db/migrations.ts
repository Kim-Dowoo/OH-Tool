import type Database from "better-sqlite3";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function runMigrations(db: Database.Database): void {
  db.pragma("foreign_keys = ON");
  const migrationDirectory = [
    resolve(process.cwd(), "migrations", "001_initial.sql"),
    resolve(process.cwd(), "app", "migrations", "001_initial.sql"),
  ].find(existsSync)?.replace(/[\\/]001_initial\.sql$/, "");
  if (!migrationDirectory) throw new Error("초기 데이터베이스 마이그레이션을 찾을 수 없습니다.");

  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);
  const applied = db.prepare("SELECT 1 FROM schema_migrations WHERE name = ?");
  const record = db.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)");
  const run = db.transaction(() => {
    for (const name of [
      "001_initial.sql",
      "002_repository_hardening.sql",
      "003_allocation_update_guards.sql",
      "004_shipment_status_integrity.sql",
    ]) {
      if (applied.get(name)) continue;
      db.exec(readFileSync(resolve(migrationDirectory, name), "utf8"));
      record.run(name, new Date().toISOString());
    }
  });
  run();
}
