export type Severity = "low" | "medium" | "high" | "critical";

export type OutputFormat = "text" | "json";

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  message: string;
  remediation: string;
  serverName?: string;
  path: string;
  evidence?: string;
}

export interface McpServer {
  name: string;
  path: string;
  value: unknown;
  command?: string;
  args: string[];
  env: Record<string, unknown>;
  tools: string[];
}

export interface ScanOptions {
  failOn: Severity;
}

export interface ScanReport {
  source: string;
  serverCount: number;
  findings: Finding[];
}

export interface CliOptions {
  format: OutputFormat;
  failOn: Severity;
}
