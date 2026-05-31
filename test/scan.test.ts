import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { promisify } from "node:util";

import { scanConfig } from "../src/index.js";

const execFileAsync = promisify(execFile);

test("scanConfig reports risky MCP server patterns", async () => {
  const content = await readFile("tests/fixtures/risky.json", "utf8");
  const report = scanConfig("tests/fixtures/risky.json", content);
  const ids = report.findings.map((finding) => finding.id);

  assert.equal(report.serverCount, 3);
  assert.ok(ids.includes("command.shell-eval"));
  assert.ok(ids.includes("command.pipe-to-shell"));
  assert.ok(ids.includes("package.unpinned"));
  assert.ok(ids.includes("env.broad-pass-through"));
  assert.ok(ids.includes("env.sensitive-name"));
  assert.ok(ids.includes("filesystem.writable-mount"));
  assert.ok(ids.includes("tool.duplicate-name"));
});

test("scanConfig allows clean pinned configs", async () => {
  const content = await readFile("tests/fixtures/clean.json", "utf8");
  const report = scanConfig("tests/fixtures/clean.json", content);

  assert.equal(report.serverCount, 2);
  assert.deepEqual(report.findings, []);
});

test("CLI scans a file and exits zero below the fail threshold", async () => {
  const { stdout } = await execFileAsync("node", [
    "dist/src/cli.js",
    "scan",
    "tests/fixtures/clean.json",
    "--format",
    "text",
    "--fail-on",
    "high"
  ]);

  assert.match(stdout, /no findings/);
});

test("CLI emits JSON and exits non-zero when findings meet the threshold", async () => {
  await assert.rejects(
    execFileAsync("node", [
      "dist/src/cli.js",
      "scan",
      "--format",
      "json",
      "--fail-on",
      "medium",
      "tests/fixtures/risky.json"
    ]),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      const failure = error as Error & { code?: number; stdout?: string };
      assert.equal(failure.code, 1);
      const report = JSON.parse(failure.stdout ?? "{}") as { findings?: Array<{ id: string }> };
      assert.ok(report.findings?.some((finding) => finding.id === "command.pipe-to-shell"));
      return true;
    }
  );
});

test("CLI scans stdin", async () => {
  const content = await readFile("tests/fixtures/clean.json", "utf8");
  const result = await spawnWithInput("node", [
    "dist/src/cli.js",
    "scan",
    "-",
    "--format",
    "json"
  ], content);
  const report = JSON.parse(result.stdout) as { source: string; findings: unknown[] };

  assert.equal(result.code, 0);
  assert.equal(report.source, "-");
  assert.deepEqual(report.findings, []);
});

async function spawnWithInput(command: string, args: string[], input: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
    child.stdin.end(input);
  });
}
