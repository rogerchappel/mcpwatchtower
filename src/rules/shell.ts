import { finding } from "../finding.js";
import type { Finding, McpServer } from "../types.js";

export function scanShellExecution(server: McpServer): Finding[] {
  const command = server.command ?? "";
  const args = server.args;
  const shell = shellKind(command);

  if (shell === undefined) {
    return [];
  }

  const shellFlagIndex = args.findIndex((arg) => isInlineCommandFlag(shell, arg));
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

type ShellKind = "posix" | "cmd" | "powershell";

function shellKind(command: string): ShellKind | undefined {
  const base = command.split(/[\\/]/).pop()?.toLowerCase();

  if (base === "sh" || base === "bash" || base === "zsh") {
    return "posix";
  }

  if (base === "cmd" || base === "cmd.exe") {
    return "cmd";
  }

  if (base === "powershell" || base === "powershell.exe" || base === "pwsh" || base === "pwsh.exe") {
    return "powershell";
  }

  return undefined;
}

function isInlineCommandFlag(shell: ShellKind, arg: string): boolean {
  const flag = arg.toLowerCase();

  if (shell === "posix") {
    return flag === "-c";
  }

  if (shell === "cmd") {
    return flag === "/c" || flag === "/k";
  }

  return flag === "-c" || flag === "-command" || flag === "-e" || flag === "-ec" || flag === "-encodedcommand";
}
