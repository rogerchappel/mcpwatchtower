#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import process from "node:process";

import { scanConfig } from "./index.js";
import { isSeverity, meetsThreshold } from "./severity.js";
import type { CliOptions, OutputFormat, ScanReport, Severity } from "./types.js";

const defaultOptions: CliOptions = {
  format: "text",
  failOn: "high"
};

async function main(argv: string[]): Promise<number> {
  const parsed = parseArgs(argv);
  if (parsed.help) {
    process.stdout.write(helpText());
    return 0;
  }

  if (parsed.error) {
    process.stderr.write(`${parsed.error}\n\n${helpText()}`);
    return 2;
  }

  const source = parsed.source ?? "-";

  try {
    const content = await readInput(source);
    const report = scanConfig(source, content);
    process.stdout.write(formatReport(report, parsed.options));
    return shouldFail(report, parsed.options.failOn) ? 1 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`mcpwatchtower: ${message}\n`);
    return 2;
  }
}

interface ParsedArgs {
  source?: string;
  options: CliOptions;
  help: boolean;
  error?: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const options: CliOptions = { ...defaultOptions };
  const args = [...argv];
  const command = args.shift();

  if (!command || command === "--help" || command === "-h") {
    return { options, help: true };
  }

  if (command !== "scan") {
    return { options, help: false, error: `Unknown command: ${command}` };
  }

  let source: string | undefined;

  while (args.length > 0) {
    const arg = args.shift();
    if (arg === undefined) {
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      return { options, help: true };
    }

    if (arg === "--format") {
      const value = args.shift();
      if (!isOutputFormat(value)) {
        return { options, help: false, error: "--format must be 'text' or 'json'" };
      }

      options.format = value;
      continue;
    }

    if (arg === "--fail-on") {
      const value = args.shift();
      if (!isSeverity(value)) {
        return { options, help: false, error: "--fail-on must be low, medium, high, or critical" };
      }

      options.failOn = value;
      continue;
    }

    if (arg.startsWith("-") && arg !== "-") {
      return { options, help: false, error: `Unknown option: ${arg}` };
    }

    if (source !== undefined) {
      return { options, help: false, error: "Only one config source can be scanned at a time" };
    }

    source = arg;
  }

  const result: ParsedArgs = { options, help: false };
  if (source !== undefined) {
    result.source = source;
  }

  return result;
}

async function readInput(source: string): Promise<string> {
  if (source === "-") {
    return new Promise((resolve, reject) => {
      let data = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk: string) => {
        data += chunk;
      });
      process.stdin.on("end", () => resolve(data));
      process.stdin.on("error", reject);
    });
  }

  return readFile(source, "utf8");
}

function formatReport(report: ScanReport, options: CliOptions): string {
  if (options.format === "json") {
    return `${JSON.stringify(report, null, 2)}\n`;
  }

  if (report.findings.length === 0) {
    return `mcpwatchtower: no findings in ${report.source} (${report.serverCount} servers scanned)\n`;
  }

  const lines = [
    `mcpwatchtower: ${report.findings.length} finding(s) in ${report.source} (${report.serverCount} servers scanned)`
  ];

  for (const item of report.findings) {
    lines.push("");
    lines.push(`[${item.severity}] ${item.id}: ${item.title}`);
    lines.push(`  server: ${item.serverName ?? "unknown"}`);
    lines.push(`  path: ${item.path}`);
    lines.push(`  message: ${item.message}`);
    lines.push(`  remediation: ${item.remediation}`);
    if (item.evidence) {
      lines.push(`  evidence: ${item.evidence}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function shouldFail(report: ScanReport, failOn: Severity): boolean {
  return report.findings.some((finding) => meetsThreshold(finding.severity, failOn));
}

function isOutputFormat(value: string | undefined): value is OutputFormat {
  return value === "text" || value === "json";
}

function helpText(): string {
  return `Usage:
  mcpwatchtower scan [config.json|-] [--format text|json] [--fail-on low|medium|high|critical]

Server entries require a non-empty string command. Optional args is a string
array, env is an object map, and tools is an array of names or named objects.

Examples:
  mcpwatchtower scan .mcp.json
  mcpwatchtower scan examples/risky.mcp.json --format json --fail-on medium
  cat config.json | mcpwatchtower scan -
`;
}

main(process.argv.slice(2)).then((exitCode) => {
  process.exitCode = exitCode;
});
