import { finding } from "../finding.js";
import type { Finding, McpServer } from "../types.js";

const pipeToShellPattern = /\b(curl|wget)\b[\s\S]*\|\s*(sudo\s+)?(sh|bash|zsh)\b/i;

export function scanPipeToShell(server: McpServer): Finding[] {
  const launch = [server.command, ...server.args].filter(Boolean).join(" ");
  if (!pipeToShellPattern.test(launch)) {
    return [];
  }

  return [
    finding(
      server,
      "command.pipe-to-shell",
      "critical",
      "Network download is piped to a shell",
      "Downloading script content and executing it immediately makes the launched server depend on mutable remote code.",
      "Install the server package through a pinned dependency or vendor and review the script before execution.",
      launch
    )
  ];
}
