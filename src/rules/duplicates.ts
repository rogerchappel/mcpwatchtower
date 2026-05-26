import type { Finding, McpServer } from "../types.js";

export function scanDuplicates(servers: McpServer[]): Finding[] {
  return [
    ...duplicateServerNames(servers),
    ...duplicateToolNames(servers)
  ];
}

function duplicateServerNames(servers: McpServer[]): Finding[] {
  const seen = new Map<string, McpServer>();
  const findings: Finding[] = [];

  for (const server of servers) {
    const previous = seen.get(server.name);
    if (previous) {
      findings.push({
        id: "server.duplicate-name",
        severity: "medium",
        title: "Duplicate server name",
        message: `Server name '${server.name}' appears more than once and may make review output ambiguous.`,
        remediation: "Give each MCP server a unique, stable name.",
        serverName: server.name,
        path: server.path,
        evidence: `${previous.path} and ${server.path}`
      });
      continue;
    }

    seen.set(server.name, server);
  }

  return findings;
}

function duplicateToolNames(servers: McpServer[]): Finding[] {
  const seen = new Map<string, McpServer>();
  const findings: Finding[] = [];

  for (const server of servers) {
    for (const tool of server.tools) {
      const previous = seen.get(tool);
      if (previous) {
        findings.push({
          id: "tool.duplicate-name",
          severity: "low",
          title: "Duplicate tool name",
          message: `Tool name '${tool}' is exposed by multiple servers and may confuse agent routing or human review.`,
          remediation: "Rename duplicate tools or scope them behind distinct server names.",
          serverName: server.name,
          path: server.path,
          evidence: `${previous.name} and ${server.name}: ${tool}`
        });
        continue;
      }

      seen.set(tool, server);
    }
  }

  return findings;
}
