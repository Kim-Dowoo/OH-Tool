import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { getRuntimeMode } from "@/lib/config/runtime-mode";

export function openDatabase(databasePath?: string): Database.Database {
  if (getRuntimeMode() === "demo") {
    throw new Error("데모 모드에서는 로컬 데이터베이스를 열 수 없습니다.");
  }

  const configuredPath = databasePath ?? process.env.LOCAL_DB_PATH ?? "../data/oh-management.db";
  const path = configuredPath === ":memory:" ? configuredPath : resolve(process.cwd(), configuredPath);
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }

  const db = new Database(path);
  db.pragma("foreign_keys = ON");
  return db;
}
