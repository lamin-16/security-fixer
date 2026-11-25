import { createHash } from "node:crypto";
import type { Finding, FindingSource, Severity } from "./types.js";

interface SarifLocation {
  physicalLocation?: {
    artifactLocation?: { uri?: string };
    region?: { startLine?: number };
  };
}

interface SarifResult {
  ruleId?: string;
  level?: string;
  message?: { text?: string };
  locations?: SarifLocation[];
}

/** Wandelt die SARIF-Stufe in eine Schweregradstufe um. */
export function levelToSeverity(level?: string): Severity {
  switch (level) {
    case "error":
      return "high";
    case "warning":
      return "medium";
    case "note":
      return "low";
    case "none":
      return "info";
    default:
      return "medium";
  }
}

export function fingerprint(...parts: (string | number | undefined)[]): string {
  return createHash("sha256")
    .update(parts.map((p) => p ?? "").join("|"))
    .digest("hex")
    .slice(0, 16);
}

/** Liest ein SARIF-Dokument (Version 2.1.0) und liefert normalisierte Befunde. */
export function parseSarif(doc: unknown, source: FindingSource): Finding[] {
  const runs = (doc as { runs?: { results?: SarifResult[] }[] })?.runs ?? [];
  const findings: Finding[] = [];

  for (const run of runs) {
    for (const result of run.results ?? []) {
      const phys = result.locations?.[0]?.physicalLocation;
      const file = phys?.artifactLocation?.uri;
      const line = phys?.region?.startLine;
      const rule = result.ruleId ?? "unbekannte-regel";

      findings.push({
        id: "",
        source,
        rule,
        severity: levelToSeverity(result.level),
        message: result.message?.text ?? rule,
        file,
        line,
        fingerprint: fingerprint(source, rule, file, line),
      });
    }
  }
  return findings;
}
