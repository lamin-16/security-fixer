import type { Finding, Severity } from "./types.js";

const RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

/**
 * Entfernt doppelte Befunde, filtert nach Mindestschwere,
 * sortiert nach Schwere und vergibt laufende IDs.
 */
export function triage(findings: Finding[], minSeverity: Severity = "low"): Finding[] {
  const unique = new Map<string, Finding>();
  for (const f of findings) {
    if (!unique.has(f.fingerprint)) unique.set(f.fingerprint, f);
  }

  return [...unique.values()]
    .filter((f) => RANK[f.severity] <= RANK[minSeverity])
    .sort(
      (a, b) =>
        RANK[a.severity] - RANK[b.severity] || (a.file ?? "").localeCompare(b.file ?? ""),
    )
    .map((f, i) => ({ ...f, id: `F-${String(i + 1).padStart(3, "0")}` }));
}
