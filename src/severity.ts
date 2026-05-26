import type { Severity } from "./types.js";

export const severityOrder: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

export function isSeverity(value: unknown): value is Severity {
  return value === "low" || value === "medium" || value === "high" || value === "critical";
}

export function meetsThreshold(severity: Severity, threshold: Severity): boolean {
  return severityOrder[severity] >= severityOrder[threshold];
}
