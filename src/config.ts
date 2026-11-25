import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Finding } from "./types.js";

export const CONFIG_DATEI = ".sicherheitsfixer.json";

export interface AusschlussRegel {
  /** Glob-Muster relativ zum Repository, z. B. "test/**" */
  muster: string;
  /** Pflichtfeld: warum dieser Bereich ausgeschlossen wird */
  grund: string;
}

/**
 * Liest .sicherheitsfixer.json aus dem Repository-Wurzelverzeichnis.
 * Fehlt die Datei, gibt es keine Ausschlüsse. Eine fehlerhafte Datei
 * führt zu einem Fehler, damit Ausschlüsse nie stillschweigend ignoriert werden.
 */
export async function loadAusschluss(dir: string): Promise<AusschlussRegel[]> {
  let text: string;
  try {
    text = await readFile(join(dir, CONFIG_DATEI), "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${CONFIG_DATEI} ist kein gültiges JSON`);
  }

  const liste = (data as { ausschliessen?: unknown })?.ausschliessen;
  if (liste === undefined) return [];
  if (!Array.isArray(liste)) {
    throw new Error(`${CONFIG_DATEI}: "ausschliessen" muss eine Liste sein`);
  }

  return liste.map((eintrag, i) => {
    const muster = (eintrag as AusschlussRegel)?.muster;
    const grund = (eintrag as AusschlussRegel)?.grund;
    if (typeof muster !== "string" || muster.trim() === "") {
      throw new Error(`${CONFIG_DATEI}: Eintrag ${i + 1} braucht ein "muster"`);
    }
    if (typeof grund !== "string" || grund.trim() === "") {
      throw new Error(`${CONFIG_DATEI}: Eintrag ${i + 1} braucht einen "grund"`);
    }
    return { muster, grund };
  });
}

/** Einheitliche Schreibweise für Pfade: Schrägstriche, ohne führendes "./". */
export function normalisePfad(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

/**
 * Wandelt ein Glob in einen regulären Ausdruck um.
 * "**" über mehrere Ordner, "*" nur innerhalb eines Ordners, "?" ein Zeichen.
 */
export function globToRegex(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      if (glob[i + 2] === "/") {
        re += "(?:.*/)?";
        i += 2;
      } else {
        re += ".*";
        i += 1;
      }
    } else if (c === "*") {
      re += "[^/]*";
    } else if (c === "?") {
      re += "[^/]";
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${re}$`);
}

/** Trennt Befunde in behaltene und ausgeschlossene. Befunde ohne Datei bleiben immer erhalten. */
export function filterExcluded(
  findings: Finding[],
  regeln: AusschlussRegel[],
): { behalten: Finding[]; ausgeschlossen: number } {
  const matcher = regeln.map((r) => globToRegex(normalisePfad(r.muster)));
  const behalten: Finding[] = [];
  let ausgeschlossen = 0;

  for (const f of findings) {
    const pfad = f.file ? normalisePfad(f.file) : undefined;
    if (pfad && matcher.some((m) => m.test(pfad))) {
      ausgeschlossen++;
    } else {
      behalten.push(f);
    }
  }
  return { behalten, ausgeschlossen };
}
