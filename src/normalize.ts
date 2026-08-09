import { isRecord } from "./json.js";
import { propertyPath } from "./json-path.js";
import type { McpServer } from "./types.js";

export function normalizeServers(config: unknown): McpServer[] {
  if (Array.isArray(config)) {
    return config.flatMap((value, index) => (
      isRecord(value) ? [normalizeServer(String(index), `$[${index}]`, value)] : []
    ));
  }

  if (!isRecord(config)) {
    return [];
  }

  if (Object.hasOwn(config, "mcpServers") && !isRecord(config.mcpServers)) {
    return [];
  }

  const mcpServers = config.mcpServers;
  const nested = isRecord(mcpServers);
  const serverSource = nested ? mcpServers : config;
  const serverSourcePath = nested ? "$.mcpServers" : "$";
  return Object.entries(serverSource).flatMap(([name, value]) => (
    isRecord(value) ? [normalizeServer(name, propertyPath(serverSourcePath, name), value)] : []
  ));
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
