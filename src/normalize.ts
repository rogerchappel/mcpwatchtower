import { isRecord } from "./json.js";
import type { McpServer } from "./types.js";

export function normalizeServers(config: unknown): McpServer[] {
  if (Array.isArray(config)) {
    return config.map((value, index) => normalizeServer(String(index), `$[${index}]`, value));
  }

  if (!isRecord(config)) {
    return [];
  }

  const serverSource = isRecord(config.mcpServers) ? config.mcpServers : config;
  return Object.entries(serverSource).map(([name, value]) => normalizeServer(name, `$.${escapePath(name)}`, value));
}

function normalizeServer(name: string, path: string, value: unknown): McpServer {
  if (!isRecord(value)) {
    return {
      name,
      path,
      value,
      args: [],
      env: {},
      tools: []
    };
  }

  const server: McpServer = {
    name: serverName(name, value),
    path,
    value,
    args: stringArray(value.args),
    env: isRecord(value.env) ? value.env : {},
    tools: discoverTools(value)
  };

  const command = stringValue(value.command);
  if (command !== undefined) {
    server.command = command;
  }

  return server;
}

function serverName(fallback: string, value: Record<string, unknown>): string {
  return stringValue(value.name) ?? fallback;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function discoverTools(value: Record<string, unknown>): string[] {
  const tools = value.tools;
  if (!Array.isArray(tools)) {
    return [];
  }

  return tools
    .map((tool) => {
      if (typeof tool === "string") {
        return tool;
      }

      if (isRecord(tool) && typeof tool.name === "string") {
        return tool.name;
      }

      return undefined;
    })
    .filter((tool): tool is string => Boolean(tool));
}

function escapePath(key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
}
