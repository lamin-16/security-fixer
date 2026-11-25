import { fingerprint } from "./sarif.js";
import type { Finding, Severity } from "./types.js";

const RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

/**
 * Fasst ESLint-Befunde an derselben Datei und Zeile zu einem Befund zusammen.
 * Mehrere Regeln, die dieselbe Stelle melden, erscheinen so nur einmal.
 * Befunde anderer Quellen bleiben unverändert.
 */
export function zusammenfuehren(findings: Finding[]): Finding[] {
  const gruppen = new Map<string, { befund: Finding; regeln: string[] }>();
  const rest: Finding[] = [];

  for (const f of findings) {
    if (f.source !== "eslint" || f.line === undefined) {
      rest.push(f);
      continue;
    }

    const key = `${f.file}:${f.line}`;
    const gruppe = gruppen.get(key);
    if (!gruppe) {
      gruppen.set(key, { befund: { ...f }, regeln: [f.rule] });
      continue;
    }
    if (gruppe.regeln.includes(f.rule)) continue;

    gruppe.regeln.push(f.rule);
    if (RANK[f.severity] < RANK[gruppe.befund.severity]) {
      gruppe.befund.severity = f.severity;
    }
  }

  const zusammen = [...gruppen.values()].map(({ befund, regeln }) => {
    if (regeln.length === 1) return befund;
    return {
      ...befund,
      rule: regeln.join(" + "),
      message: `${befund.message} (zusätzlich gemeldet von: ${regeln.slice(1).join(", ")})`,
      fingerprint: fingerprint("eslint-merge", regeln.join("|"), befund.file, befund.line),
    };
  });

  return [...zusammen, ...rest];
}

/**
 * Entfernt doppelte Befunde, fasst Mehrfachmeldungen zusammen,
 * filtert nach Mindestschwere, sortiert nach Schwere und vergibt laufende IDs.
 */
export function triage(findings: Finding[], minSeverity: Severity = "low"): Finding[] {
  const unique = new Map<string, Finding>();
  for (const f of zusammenfuehren(findings)) {
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
