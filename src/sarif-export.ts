import type { Finding, Severity } from "./types.js";

const LEVEL: Record<Severity, "error" | "warning" | "note"> = {
  critical: "error",
  high: "error",
  medium: "warning",
  low: "note",
  info: "note",
};

/** Erste Regel einer zusammengeführten Meldung, z. B. "a + b" wird zu "a". */
export function primaerRegel(rule: string): string {
  return rule.split(" + ")[0];
}

/** Erzeugt einen Bericht im SARIF-2.1.0-Format. */
export function berichtAlsSarif(findings: Finding[], version: string) {
  const regelIds = [...new Set(findings.map((f) => primaerRegel(f.rule)))];

  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "Sicherheitsfixer",
            version,
            informationUri: "https://github.com/lamin-16/security-fixer",
            rules: regelIds.map((id) => ({
              id,
              name: id,
              shortDescription: { text: id },
            })),
          },
        },
        results: findings.map((f) => ({
          ruleId: primaerRegel(f.rule),
          level: LEVEL[f.severity],
          message: { text: f.message },
          partialFingerprints: { befund: f.fingerprint },
          ...(f.file
            ? {
                locations: [
                  {
                    physicalLocation: {
                      artifactLocation: { uri: f.file },
                      ...(f.line ? { region: { startLine: f.line } } : {}),
                    },
                  },
                ],
              }
            : {}),
        })),
      },
    ],
  };
}
