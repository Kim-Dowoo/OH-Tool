import { afterEach, describe, expect, it } from "vitest";
import { chdir } from "node:process";

import { openDatabase } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrations";

const appDirectory = process.cwd();
const repositoryDirectory = `${appDirectory}/..`;
const originalVercel = process.env.VERCEL;
const originalAppMode = process.env.APP_MODE;

afterEach(() => {
  chdir(appDirectory);
  if (originalVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = originalVercel;
  if (originalAppMode === undefined) delete process.env.APP_MODE;
  else process.env.APP_MODE = originalAppMode;
});

describe("database client", () => {
  it("fails closed when Vercel does not explicitly use demo mode", () => {
    process.env.VERCEL = "1";
    process.env.APP_MODE = "local";

    expect(() => openDatabase(":memory:")).toThrow("Vercel에서는 APP_MODE=demo만 허용됩니다.");
  });

  it("finds migrations when invoked from the repository root", () => {
    const db = openDatabase(":memory:");
    chdir(repositoryDirectory);

    runMigrations(db);

    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'requests'").get()).toEqual({
      name: "requests",
    });
  });
});
