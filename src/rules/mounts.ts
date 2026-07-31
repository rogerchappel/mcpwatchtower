import { finding } from "../finding.js";
import type { Finding, McpServer } from "../types.js";

const mountFlags = new Set(["-v", "--volume", "--mount"]);

export function scanWritableMounts(server: McpServer): Finding[] {
  const findings: Finding[] = [];

  for (let index = 0; index < server.args.length; index += 1) {
    const arg = server.args[index];
    const next = server.args[index + 1];
    if (arg === undefined) {
      continue;
    }

    const candidate = mountCandidate(arg, next);

    if (candidate && !isReadOnlyMount(arg, candidate)) {
      findings.push(
        finding(
          server,
          "filesystem.writable-mount",
          "medium",
          "Writable filesystem mount is hinted",
          "The launch arguments appear to grant write access to a host path.",
          "Use read-only mounts when possible and limit host paths to the smallest required directory.",
          candidate
        )
      );
    }
  }

  return findings;
}

function isReadOnlyMount(arg: string, candidate: string): boolean {
  const flag = arg.split("=", 1)[0];
  if (flag === "--mount") {
    return candidate.split(",").some((part) => {
      const option = part.trim().toLowerCase();
      return option === "readonly" || option === "ro" || /^readonly=(?:true|1)$/.test(option);
    });
  }

  const options = candidate.slice(candidate.lastIndexOf(":") + 1).toLowerCase().split(",");
  return options.includes("ro") || options.includes("readonly");
}

function mountCandidate(arg: string, next: string | undefined): string | undefined {
  if (mountFlags.has(arg)) {
    return next;
  }

  for (const flag of mountFlags) {
    if (arg.startsWith(`${flag}=`)) {
      return arg.slice(flag.length + 1);
    }
  }

  return undefined;
}
