import { execFile } from "node:child_process";
import { access, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);

/** Nur existierende Git-Repositories werden akzeptiert, damit jede Änderung rückgängig gemacht werden kann. */
export async function assertRepo(input: string): Promise<string> {
  const dir = resolve(input);
  const st = await stat(dir).catch(() => null);
  if (!st?.isDirectory()) throw new Error(`Verzeichnis nicht gefunden: ${dir}`);
  await access(join(dir, ".git")).catch(() => {
    throw new Error("Kein Git-Repository. Das Tool arbeitet nur mit Git, damit Änderungen rückgängig gemacht werden können.");
  });
  return dir;
}

/** Verhindert, dass Änderungen mit fremden, ungespeicherten Arbeiten vermischt werden. */
export async function assertCleanTree(dir: string): Promise<void> {
  const { stdout } = await exec("git", ["status", "--porcelain"], { cwd: dir });
  if (stdout.trim()) {
    throw new Error("Das Arbeitsverzeichnis ist nicht sauber. Bitte zuerst committen oder stashen.");
  }
}

/** Prüft, ob ein Pfad innerhalb des Repositories liegt und nicht geschützt ist. */
export function safeFilePath(repo: string, relPath: string): string {
  if (isAbsolute(relPath)) throw new Error(`Absoluter Pfad verweigert: ${relPath}`);

  const full = resolve(repo, relPath);
  const rel = relative(repo, full);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`Pfad außerhalb des Repositories verweigert: ${relPath}`);
  }

  const parts = rel.split(sep);
  const geschuetzt = parts.some((p) => p === ".git" || p === "node_modules" || p.startsWith(".env"));
  if (geschuetzt) throw new Error(`Geschützter Pfad verweigert: ${relPath}`);

  return full;
}
