import { finding } from "../finding.js";
import type { Finding, McpServer } from "../types.js";

export function scanShellExecution(server: McpServer): Finding[] {
  const command = server.command ?? "";
  const args = server.args;

  if (!isShell(command)) {
    return [];
  }

  const shellFlagIndex = args.findIndex((arg) => arg === "-c" || arg === "/c");
  if (shellFlagIndex === -1) {
    return [];
  }

  return [
    finding(
      server,
      "command.shell-eval",
      "high",
      "Shell evaluation is enabled",
      "This server launches a shell with an inline command string, which expands the blast radius of prompt-injection or config tampering.",
      "Invoke a pinned executable directly and pass fixed arguments instead of using shell evaluation.",
      `${command} ${args.slice(shellFlagIndex, shellFlagIndex + 2).join(" ")}`
    )
  ];
}

function isShell(command: string): boolean {
  const base = command.split(/[\\/]/).pop()?.toLowerCase();
  return base === "sh" || base === "bash" || base === "zsh" || base === "cmd" || base === "powershell";
}
