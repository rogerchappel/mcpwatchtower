import { finding } from "../finding.js";
import type { Finding, McpServer } from "../types.js";

const broadEnvNames = new Set(["*", "ALL", "ENV", "PROCESS_ENV", "process.env"]);
const sensitiveNamePattern = /(TOKEN|SECRET|PASSWORD|PASS|KEY|CREDENTIAL|COOKIE|SESSION|AUTH)/i;

export function scanEnvironment(server: McpServer): Finding[] {
  const findings: Finding[] = [];

  for (const [name, value] of Object.entries(server.env)) {
    if (isBroadValue(name, value)) {
      findings.push(
        finding(
          server,
          "env.broad-pass-through",
          "high",
          "Broad environment pass-through is configured",
          "The server appears to receive a broad environment set, which may expose unrelated credentials to the MCP process.",
          "Pass only the exact environment variables required by this server.",
          `${name}=${String(value)}`
        )
      );
    }

    if (sensitiveNamePattern.test(name)) {
      findings.push(
        finding(
          server,
          "env.sensitive-name",
          "medium",
          "Sensitive-looking environment variable is passed",
          "The server receives an environment variable whose name suggests credential material.",
          "Prefer scoped, least-privilege tokens and avoid passing secrets unless this server strictly needs them.",
          name
        )
      );
    }
  }

  return findings;
}

function isBroadValue(name: string, value: unknown): boolean {
  if (broadEnvNames.has(name)) {
    return true;
  }

  if (typeof value === "string") {
    return value === "*" || value === "${env}" || value === "$ENV" || value === "process.env";
  }

  return value === true;
}
