import { appendFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/** Außerhalb des Repositories, damit das Protokoll nie versehentlich committet wird. */
const DIR = join(homedir(), ".sicherheitsfixer");

export async function audit(eintrag: Record<string, unknown>): Promise<void> {
  await mkdir(DIR, { recursive: true });
  const zeile = JSON.stringify({ zeit: new Date().toISOString(), ...eintrag });
  await appendFile(join(DIR, "audit.jsonl"), zeile + "\n", "utf8");
}
