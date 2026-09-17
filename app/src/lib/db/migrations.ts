import type Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function runMigrations(db: Database.Database): void {
  db.pragma("foreign_keys = ON");
  const migration = readFileSync(resolve(process.cwd(), "migrations", "001_initial.sql"), "utf8");
  db.exec(migration);
}
