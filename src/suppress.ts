import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { primaerRegel } from "./sarif-export.js";
import type { Finding } from "./types.js";

/**
 * Format: // sicherheitsfixer-ignore: <regel> -- <begründung>
 * Die Begründung ist Pflicht. Ohne sie wirkt die Unterdrückung nicht.
 */
const MUSTER = /sicherheitsfixer-ignore:\s*(\S+)\s*--\s*(\S.*)$/;

/** Prüft eine Zeile auf eine gültige Unterdrückung für die Regel. */
export function istUnterdrueckt(zeile: string, regel: string): boolean {
  const treffer = zeile.match(MUSTER);
  if (!treffer) return false;
  const ziel = treffer[1];
  return ziel === "*" || ziel === primaerRegel(regel) || ziel === regel;
}

/** Entfernt Befunde, die in ihrer Zeile oder der Zeile darüber unterdrückt sind. */
export async function filterInline(
  findings: Finding[],
  dir: string,
): Promise<{ behalten: Finding[]; unterdrueckt: number }> {
  const cache = new Map<string, string[] | null>();
  const behalten: Finding[] = [];
  let unterdrueckt = 0;

  for (const f of findings) {
    if (!f.file || !f.line) {
      behalten.push(f);
      continue;
    }

    let zeilen = cache.get(f.file);
    if (zeilen === undefined) {
      zeilen = await readFile(join(dir, f.file), "utf8").then(
        (t) => t.split(/\r?\n/),
        () => null,
      );
      cache.set(f.file, zeilen);
    }

    const kandidaten = zeilen ? [zeilen[f.line - 1], zeilen[f.line - 2]] : [];
    if (kandidaten.some((z) => z !== undefined && istUnterdrueckt(z, f.rule))) {
      unterdrueckt++;
    } else {
      behalten.push(f);
    }
  }
  return { behalten, unterdrueckt };
}
