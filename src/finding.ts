import type { Finding, McpServer, Severity } from "./types.js";

export function finding(
  server: McpServer,
  id: string,
  severity: Severity,
  title: string,
  message: string,
  remediation: string,
  evidence?: string
): Finding {
  return {
    id,
    severity,
    title,
    message,
    remediation,
    serverName: server.name,
    path: server.path,
    evidence
  };
}
