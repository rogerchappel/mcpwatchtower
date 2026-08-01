import { isRecord } from "./json.js";
import type { Finding } from "./types.js";

export function validateConfigShape(config: unknown): Finding[] {
  if (Array.isArray(config)) {
    if (config.length === 0) {
      return [invalidShape("$", "The server array must contain at least one server object.")];
    }

    return config.flatMap((value, index) => (
      isRecord(value)
        ? []
        : [invalidShape(`$[${index}]`, "Each array entry must be a server object.")]
    ));
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

  return entries.flatMap(([name, value]) => (
    isRecord(value)
      ? []
      : [invalidShape(propertyPath(path, name), "Each server map entry must be a server object.")]
  ));
}

function invalidShape(path: string, message: string): Finding {
  return {
    id: "config.invalid-shape",
    severity: "high",
    title: "Invalid MCP config shape",
    message,
    remediation: "Use a non-empty raw server map, a non-empty mcpServers map, or a non-empty array containing only server objects.",
    path
  };
}

function propertyPath(parent: string, key: string): string {
  const property = /^[A-Za-z_$][\w$]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
  return `${parent}${property}`;
}
