import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { scanAll } from "./scanners.js";
import type { Finding } from "./types.js";

const exec = promisify(execFile);

async function exists(dir: string, file: string): Promise<boolean> {
  return access(join(dir, file)).then(() => true, () => false);
}

export interface Verdict {
  ok: boolean;
  reasons: string[];
}

/**
 * Prüft eine angewendete Korrektur:
 * 1. der konkrete Befund (Regel + Datei) ist verschwunden,
 * 2. TypeScript kompiliert,
 * 3. die Tests laufen durch.
 */
export async function verifyFix(dir: string, target: Finding, semgrepConfig: string): Promise<Verdict> {
  const reasons: string[] = [];

  const { findings } = await scanAll(dir, semgrepConfig);
  const bestehtNoch = findings.some((f) => f.rule === target.rule && f.file === target.file);
  if (bestehtNoch) reasons.push("Befund besteht weiterhin");

  if (await exists(dir, "tsconfig.json")) {
    await exec("npx", ["tsc", "--noEmit"], { cwd: dir, timeout: 600_000 }).catch(() => {
      reasons.push("TypeScript-Prüfung fehlgeschlagen");
    });
  }

  if (await exists(dir, "package.json")) {
    await exec("npm", ["test", "--if-present"], { cwd: dir, timeout: 600_000 }).catch(() => {
      reasons.push("Tests fehlgeschlagen");
    });
  }

  return { ok: reasons.length === 0, reasons };
}
