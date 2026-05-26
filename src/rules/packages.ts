import { finding } from "../finding.js";
import type { Finding, McpServer } from "../types.js";

const packageManagers = new Set(["npx", "npm", "pnpm", "yarn", "bun", "uvx"]);

export function scanPackageSpecs(server: McpServer): Finding[] {
  const command = baseName(server.command ?? "");
  if (!packageManagers.has(command)) {
    return [];
  }

  const spec = packageSpec(command, server.args);
  if (!spec || isPinned(spec)) {
    return [];
  }

  return [
    finding(
      server,
      "package.unpinned",
      "medium",
      "Package launch is not pinned",
      "This server is launched through a package manager without a fixed package version, so future installs may execute different code.",
      "Pin the package by exact version, commit, or digest and review upgrades intentionally.",
      `${command} ${server.args.join(" ")}`
    )
  ];
}

function packageSpec(command: string, args: string[]): string | undefined {
  const positional = args.filter((arg) => !arg.startsWith("-"));
  if (command === "npm") {
    const execIndex = positional.findIndex((arg) => arg === "exec" || arg === "x");
    return execIndex >= 0 ? positional[execIndex + 1] : undefined;
  }

  if (command === "pnpm" || command === "yarn" || command === "bun") {
    const execIndex = positional.findIndex((arg) => arg === "dlx" || arg === "exec");
    return execIndex >= 0 ? positional[execIndex + 1] : undefined;
  }

  return positional[0];
}

function isPinned(spec: string): boolean {
  if (/^(https?:|git\+|file:)/.test(spec)) {
    return /[#?](?:sha|ref|commit|tag)=?[A-Fa-f0-9._/-]+/.test(spec) || /#[A-Fa-f0-9]{7,}/.test(spec);
  }

  const withoutScope = spec.startsWith("@") ? spec.slice(1) : spec;
  return /@(?:\d+\.\d+\.\d+(?:[-+][\w.-]+)?|[A-Fa-f0-9]{20,}|sha256-[A-Za-z0-9+/=]+)$/.test(withoutScope);
}

function baseName(command: string): string {
  return command.split(/[\\/]/).pop()?.toLowerCase() ?? "";
}
