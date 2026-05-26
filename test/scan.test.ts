import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { scanConfig } from "../src/index.js";

test("scanConfig reports risky MCP server patterns", async () => {
  const content = await readFile("fixtures/risky.json", "utf8");
  const report = scanConfig("fixtures/risky.json", content);
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
  const content = await readFile("fixtures/clean.json", "utf8");
  const report = scanConfig("fixtures/clean.json", content);

  assert.equal(report.serverCount, 2);
  assert.deepEqual(report.findings, []);
});
