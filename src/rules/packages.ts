import { finding } from "../finding.js";
import type { Finding, McpServer } from "../types.js";

const packageManagers = new Set(["npx", "npm", "pnpm", "yarn", "bun", "bunx", "uvx"]);
const packageOptions = new Set(["--package", "-p", "--from"]);
const optionsWithValues = new Set([
  "--cache", "--cache-dir", "--call", "-c", "--cwd", "--directory", "-C", "--loglevel",
  "--node-options", "--prefix", "--registry", "--script-shell", "--shell", "--userconfig"
]);

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
  const invocation = invocationArgs(command, args);
  if (!invocation) {
    return undefined;
  }

  for (let index = 0; index < invocation.length; index += 1) {
    const arg = invocation[index];
    if (arg === undefined || arg === "--") {
      break;
    }
    if (packageOptions.has(arg)) {
      return invocation[index + 1];
    }
    for (const option of packageOptions) {
      if (arg.startsWith(`${option}=`)) {
        return arg.slice(option.length + 1);
      }
    }
  }

  for (let index = 0; index < invocation.length; index += 1) {
    const arg = invocation[index];
    if (arg === undefined) {
      break;
    }
    if (arg === "--") {
      continue;
    }
    if (optionsWithValues.has(arg)) {
      index += 1;
    } else if (!arg.startsWith("-")) {
      return arg;
    }
  }

  return undefined;
}

function invocationArgs(command: string, args: string[]): string[] | undefined {
  if (command === "npx" || command === "bunx" || command === "uvx") {
    return args;
  }

  const modes = command === "npm" ? new Set(["exec", "x"])
    : command === "pnpm" || command === "yarn" ? new Set(["dlx", "exec"])
      : new Set(["x", "exec"]);
  const modeIndex = args.findIndex((arg) => modes.has(arg));
  return modeIndex >= 0 ? args.slice(modeIndex + 1) : undefined;
}

function isPinned(spec: string): boolean {
  if (/^(https?:|git\+|file:)/.test(spec)) {
    const commit = "[A-Fa-f0-9]{40}(?:[A-Fa-f0-9]{24})?";
    return new RegExp(`#${commit}$`).test(spec)
      || new RegExp(`[#?&](?:sha|ref|commit)=${commit}(?:[&#]|$)`).test(spec);
  }

  const withoutScope = spec.startsWith("@") ? spec.slice(1) : spec;
  return /@(?:\d+\.\d+\.\d+(?:[-+][\w.-]+)?|[A-Fa-f0-9]{20,}|sha256-[A-Za-z0-9+/=]+)$/.test(withoutScope);
}

function baseName(command: string): string {
  return command.split(/[\\/]/).pop()?.toLowerCase() ?? "";
}
