import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const verifierPath = path.resolve(
  import.meta.dirname,
  "../../../scripts/verify-no-sensitive-files.ps1",
);
const temporaryRepositories: string[] = [];

function createTrackedRepository(fileName: string): string {
  const repositoryPath = mkdtempSync(path.join(tmpdir(), "oh-management-"));
  temporaryRepositories.push(repositoryPath);
  const filePath = path.join(repositoryPath, fileName);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, "placeholder");
  mkdirSync(path.join(repositoryPath, "scripts"));
  copyFileSync(
    verifierPath,
    path.join(repositoryPath, "scripts", "verify-no-sensitive-files.ps1"),
  );
  execFileSync("git", ["init"], { cwd: repositoryPath });
  execFileSync("git", ["add", fileName], { cwd: repositoryPath });
  return repositoryPath;
}

function runVerifier(repositoryPath: string, currentDirectory = repositoryPath) {
  return spawnSync(
    "powershell",
    [
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.join(repositoryPath, "scripts", "verify-no-sensitive-files.ps1"),
    ],
    { cwd: currentDirectory, encoding: "utf8" },
  );
}

afterEach(() => {
  for (const repositoryPath of temporaryRepositories.splice(0)) {
    rmSync(repositoryPath, { force: true, recursive: true });
  }
});

describe("verify-no-sensitive-files", () => {
  it("allows the tracked non-secret environment template", () => {
    const result = runVerifier(createTrackedRepository(".env.example"));

    expect(result.status).toBe(0);
  });

  it("rejects a tracked local environment file", () => {
    const result = runVerifier(createTrackedRepository(".env.local"));

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(".env.*");
  });

  it("scans root-sensitive files when invoked from a subdirectory", () => {
    const repositoryPath = createTrackedRepository("input-samples/private.xlsx");
    const appPath = path.join(repositoryPath, "app");
    mkdirSync(appPath);

    const result = runVerifier(repositoryPath, appPath);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("input-samples/*.xlsx");
  });

  it.each(["app/.env", "app/.env.local"])(
    "rejects nested local environment file %s",
    (fileName) => {
      const result = runVerifier(createTrackedRepository(fileName));

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(".env");
    },
  );

  it.each(["data/.gitkeep", "backups/.gitkeep", "exports/.gitkeep"])(
    "allows the intentional %s placeholder",
    (fileName) => {
      const result = runVerifier(createTrackedRepository(fileName));

      expect(result.status).toBe(0);
    },
  );

  it.each(["data/private.db", "backups/archive.zip", "exports/report.csv"])(
    "continues to reject non-placeholder file %s",
    (fileName) => {
      const result = runVerifier(createTrackedRepository(fileName));

      expect(result.status).not.toBe(0);
    },
  );
});
