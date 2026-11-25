import type { Finding, Severity } from "./types.js";

const BEZ: Record<Severity, string> = {
  critical: "kritisch",
  high: "hoch",
  medium: "mittel",
  low: "niedrig",
  info: "Info",
};

const REIHENFOLGE: Severity[] = ["critical", "high", "medium", "low", "info"];

export function berichtAlsMarkdown(findings: Finding[], warnings: string[], datum: Date): string {
  const zusammenfassung = REIHENFOLGE.map(
    (s) => `- **${BEZ[s]}:** ${findings.filter((f) => f.severity === s).length}`,
  ).join("\n");

  const quellen = [...new Set(findings.map((f) => f.source))].sort();
  const nachQuelle = quellen.length
    ? quellen.map((q) => `- \`${q}\`: ${findings.filter((f) => f.source === q).length}`).join("\n")
    : "Keine Befunde.";

  const zeilen = findings.map((f) => {
    const ort = f.file ? `${f.file}${f.line ? `:${f.line}` : ""}` : "–";
    const text = f.message.replace(/\|/g, "\\|").replace(/\n/g, " ");
    return `| ${f.id} | ${BEZ[f.severity]} | ${f.source} | \`${f.rule}\` | ${ort} | ${text} |`;
  });

  const tabelle = zeilen.length
    ? ["| ID | Schwere | Quelle | Regel | Ort | Beschreibung |", "|---|---|---|---|---|---|", ...zeilen].join("\n")
    : "Keine Befunde. ✅";

  const hinweise = warnings.length
    ? `\n## Hinweise\n\n${warnings.map((w) => `- ⚠️ ${w}`).join("\n")}\n`
    : "";

  return [
    "# Sicherheitsbericht",
    "",
    `Erstellt am ${datum.toLocaleString("de-DE")}`,
    "",
    "## Zusammenfassung",
    "",
    zusammenfassung,
    "",
    "## Nach Quelle",
    "",
    nachQuelle,
    "",
    "## Befunde",
    "",
    tabelle,
    hinweise,
  ].join("\n");
}
