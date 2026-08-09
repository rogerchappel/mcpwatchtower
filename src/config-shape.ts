import { isRecord } from "./json.js";
import { propertyPath } from "./json-path.js";
import type { Finding } from "./types.js";

export function validateConfigShape(config: unknown): Finding[] {
  if (Array.isArray(config)) {
    if (config.length === 0) {
      return [invalidShape("$", "The server array must contain at least one server object.")];
    }

    return config.flatMap((value, index) => validateServer(value, `$[${index}]`));
  }

  if (!isRecord(config)) {
    return [invalidShape("$", "The config must be an object map or an array of server objects.")];
  }

  if (Object.hasOwn(config, "mcpServers")) {
    if (!isRecord(config.mcpServers)) {
      return [invalidShape("$.mcpServers", "The mcpServers value must be an object map of server objects.")];
    }

    return validateServerMap(config.mcpServers, "$.mcpServers");
  }

  return validateServerMap(config, "$");
}

function validateServerMap(servers: Record<string, unknown>, path: string): Finding[] {
  const entries = Object.entries(servers);
  if (entries.length === 0) {
    return [invalidShape(path, "The server map must contain at least one server object.")];
  }

  return entries.flatMap(([name, value]) => validateServer(value, propertyPath(path, name)));
}

function validateServer(value: unknown, path: string): Finding[] {
  if (!isRecord(value)) {
    return [invalidShape(path, "Each server entry must be a server object.")];
  }

  const findings: Finding[] = [];
  if (typeof value.command !== "string" || value.command.trim().length === 0) {
    findings.push(invalidShape(`${path}.command`, "The command field is required and must be a non-empty string."));
  }
  if (value.args !== undefined && (!Array.isArray(value.args) || value.args.some((arg) => typeof arg !== "string"))) {
    findings.push(invalidShape(`${path}.args`, "The args field must be an array of strings."));
  }
  if (value.env !== undefined && !isRecord(value.env)) {
    findings.push(invalidShape(`${path}.env`, "The env field must be an object map."));
  }
  if (value.tools !== undefined && (!Array.isArray(value.tools) || value.tools.some((tool) => (
    typeof tool !== "string" && !(isRecord(tool) && typeof tool.name === "string" && tool.name.trim().length > 0)
  )))) {
    findings.push(invalidShape(`${path}.tools`, "The tools field must be an array of strings or objects with a non-empty string name."));
  }
  return findings;
}

function invalidShape(path: string, message: string): Finding {
  return {
    id: "config.invalid-shape",
    severity: "high",
    title: "Invalid MCP config shape",
    message,
    remediation: "Use a supported config shape where every server has a non-empty string command; args is a string array, env is an object map, and tools is an array of names or objects with a string name.",
    path
  };
}
