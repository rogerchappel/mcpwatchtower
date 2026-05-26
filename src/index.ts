import { parseJsonConfig } from "./json.js";
import { normalizeServers } from "./normalize.js";
import { scanDuplicates } from "./rules/duplicates.js";
import { scanEnvironment } from "./rules/env.js";
import { scanWritableMounts } from "./rules/mounts.js";
import { scanPackageSpecs } from "./rules/packages.js";
import { scanPipeToShell } from "./rules/pipes.js";
import { scanShellExecution } from "./rules/shell.js";
import type { Finding, McpServer, ScanReport } from "./types.js";

export type { CliOptions, Finding, McpServer, OutputFormat, ScanOptions, ScanReport, Severity } from "./types.js";
export { parseJsonConfig } from "./json.js";
export { normalizeServers } from "./normalize.js";
export { isSeverity, meetsThreshold, severityOrder } from "./severity.js";

export function scanConfig(source: string, content: string): ScanReport {
  const config = parseJsonConfig(content, source);
  const servers = normalizeServers(config);

  return scanServers(source, servers);
}

export function scanServers(source: string, servers: McpServer[]): ScanReport {
  const findings: Finding[] = [
    ...scanDuplicates(servers)
  ];

  for (const server of servers) {
    findings.push(
      ...scanShellExecution(server),
      ...scanPipeToShell(server),
      ...scanPackageSpecs(server),
      ...scanEnvironment(server),
      ...scanWritableMounts(server)
    );
  }

  return {
    source,
    serverCount: servers.length,
    findings
  };
}
