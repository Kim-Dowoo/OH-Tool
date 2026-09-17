import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  writeFileSync(path.join(repositoryPath, fileName), "placeholder");
  execFileSync("git", ["init"], { cwd: repositoryPath });
  execFileSync("git", ["add", fileName], { cwd: repositoryPath });
  return repositoryPath;
}

function runVerifier(repositoryPath: string) {
  return spawnSync(
    "powershell",
    ["-ExecutionPolicy", "Bypass", "-File", verifierPath],
    { cwd: repositoryPath, encoding: "utf8" },
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
});
