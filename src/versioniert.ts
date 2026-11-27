import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { normalisePfad } from "./config.js";
import type { Finding } from "./types.js";

const exec = promisify(execFile);

/**
 * Liste der Dateien, die Git verfolgt. Das ist genau der Stand, der beim Push
 * auf GitHub landen würde. Gibt null zurück, wenn Git nicht antwortet.
 */
export async function versionierteDateien(dir: string): Promise<Set<string> | null> {
  try {
    const { stdout } = await exec("git", ["ls-files", "-z"], {
      cwd: dir,
      maxBuffer: 64 * 1024 * 1024,
    });
    return new Set(stdout.split("\0").filter(Boolean).map(normalisePfad));
  } catch {
    return null;
  }
}

/** Entfernt Befunde aus Dateien, die Git nicht verfolgt. */
export function nurVersioniert(
  findings: Finding[],
  dateien: Set<string>,
): { behalten: Finding[]; entfernt: number } {
  const behalten: Finding[] = [];
  let entfernt = 0;
  for (const f of findings) {
    if (!f.file || dateien.has(normalisePfad(f.file))) {
      behalten.push(f);
    } else {
      entfernt++;
    }
  }
  return { behalten, entfernt };
}

/** Muster, die auf einen Platzhalter statt auf einen echten Schlüssel hinweisen. */
const PLATZHALTER = /xxx+|your[_-]|<[^>]+>|example|changeme|dummy|placeholder|\*{4,}/i;

export function istPlatzhalter(zeile: string): boolean {
  return PLATZHALTER.test(zeile);
}

/**
 * Entfernt Schlüssel-Treffer, deren Zeile wie ein Platzhalter aussieht.
 * Der Schlüssel selbst wird nicht gelesen oder ausgegeben, nur die Zeile wird geprüft.
 */
export async function filterPlatzhalter(
  findings: Finding[],
  dir: string,
): Promise<{ behalten: Finding[]; entfernt: number }> {
  const cache = new Map<string, string[] | null>();
  const behalten: Finding[] = [];
  let entfernt = 0;

  for (const f of findings) {
    if (f.source !== "gitleaks" || !f.file || !f.line) {
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

    const zeile = zeilen?.[f.line - 1];
    if (zeile !== undefined && istPlatzhalter(zeile)) {
      entfernt++;
    } else {
      behalten.push(f);
    }
  }
  return { behalten, entfernt };
}
