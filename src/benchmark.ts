import { normalisePfad } from "./config.js";
import { primaerRegel } from "./sarif-export.js";
import type { Finding } from "./types.js";

export type Kategorie = "sql" | "xss" | "geheimnis" | "codeausfuehrung" | "sonstig";

/** Eine bekannte Schwachstelle, gegen die gemessen wird. */
export interface Wahrheit {
  id: string;
  file: string;
  kategorie: Kategorie;
  /** Optional. Ohne Zeile zählt jeder Befund derselben Datei und Kategorie. */
  line?: number;
  beschreibung: string;
}

export interface Ergebnis {
  bekannt: number;
  gefunden: number;
  verpasst: Wahrheit[];
  relevant: number;
  fehlalarme: number;
  recall: number | null;
  precision: number | null;
}

/** Ordnet eine Regel einer Kategorie zu. Unbekannte Regeln landen in "sonstig". */
export function kategorieVon(rule: string): Kategorie {
  const r = primaerRegel(rule);
  if (r.includes("sql-injection")) return "sql";
  if (r.includes("xss") || r.includes("no-unsanitized")) return "xss";
  if (/api-key|private-key|jwt|secret|token/.test(r)) return "geheimnis";
  if (r.includes("eval") || r.includes("non-literal-require")) return "codeausfuehrung";
  return "sonstig";
}

/** Passt ein Befund zu einer bekannten Schwachstelle? Zeilen dürfen um bis zu 3 abweichen. */
function passt(f: Finding, w: Wahrheit): boolean {
  if (normalisePfad(f.file ?? "") !== normalisePfad(w.file)) return false;
  if (kategorieVon(f.rule) !== w.kategorie) return false;
  if (w.line === undefined) return true;
  return f.line !== undefined && Math.abs(f.line - w.line) <= 3;
}

/**
 * Misst Trefferquote und Präzision.
 * Trefferquote: Anteil der bekannten Schwachstellen, die gefunden wurden.
 * Präzision: Anteil der Befunde in den gemessenen Kategorien, die einer bekannten Schwachstelle entsprechen.
 * Jeder Befund und jede Schwachstelle kann nur einmal zugeordnet werden.
 */
export function bewerte(findings: Finding[], wahrheit: Wahrheit[]): Ergebnis {
  const kategorien = new Set(wahrheit.map((w) => w.kategorie));
  const relevant = findings.filter((f) => kategorien.has(kategorieVon(f.rule)));

  const belegt = new Set<number>();
  const verpasst: Wahrheit[] = [];
  let gefunden = 0;

  for (const w of wahrheit) {
    const idx = relevant.findIndex((f, i) => !belegt.has(i) && passt(f, w));
    if (idx >= 0) {
      belegt.add(idx);
      gefunden++;
    } else {
      verpasst.push(w);
    }
  }

  return {
    bekannt: wahrheit.length,
    gefunden,
    verpasst,
    relevant: relevant.length,
    fehlalarme: relevant.length - belegt.size,
    recall: wahrheit.length > 0 ? gefunden / wahrheit.length : null,
    precision: relevant.length > 0 ? belegt.size / relevant.length : null,
  };
}

function prozent(wert: number | null): string {
  return wert === null ? "–" : `${(wert * 100).toFixed(0)} %`;
}

export function berichtBenchmark(e: Ergebnis, datum: Date): string {
  const verpassteListe = e.verpasst.length
    ? e.verpasst.map((w) => `- \`${w.id}\`: ${w.file} (${w.kategorie}), ${w.beschreibung}`).join("\n")
    : "Keine.";

  return [
    "# Benchmark-Bericht",
    "",
    `Erstellt am ${datum.toLocaleString("de-DE")}`,
    "",
    "## Ergebnis",
    "",
    `- Bekannte Schwachstellen: ${e.bekannt}`,
    `- Gefunden: ${e.gefunden}`,
    `- Verpasst: ${e.verpasst.length}`,
    `- Trefferquote (Recall): ${prozent(e.recall)}`,
    `- Relevante Befunde: ${e.relevant}`,
    `- Fehlalarme: ${e.fehlalarme}`,
    `- Präzision: ${prozent(e.precision)}`,
    "",
    "## Verpasste Schwachstellen",
    "",
    verpassteListe,
    "",
    "## Aussagekraft",
    "",
    "Diese Zahlen gelten nur für die Einträge in der Wahrheitsdatei. Eine kleine Liste ergibt keine verlässliche Aussage. Die Präzision misst nur Befunde in den Kategorien, die in der Wahrheitsdatei vorkommen.",
    "",
  ].join("\n");
}
