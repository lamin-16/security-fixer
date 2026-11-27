import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runEslint } from "../src/eslint-scan.js";

// Ungesicherter Import: Wert kommt direkt aus der Anfrage. Muss gemeldet werden.
const UNGESICHERT = `export async function laden(req: any) {
  const name = req.query.lang;
  return (await import(\`../messages/\${name}.json\`)).default;
}
`;

// Geprüfte Variable, aber der Import nutzt einen anderen Wert. Muss gemeldet werden.
const FEHLERHAFT = `const erlaubt = ['de', 'en'];
export async function laden(sprache: string, roh: string) {
  const locale = erlaubt.includes(sprache) ? roh : 'de';
  return (await import(\`../messages/\${locale}.json\`)).default;
}
`;

// Korrekt geprüft: Import nutzt den geprüften Wert. Darf nicht gemeldet werden.
const KORREKT = `const erlaubt = ['de', 'en'];
export async function laden(sprache: string) {
  const locale = erlaubt.includes(sprache) ? sprache : 'de';
  return (await import(\`../messages/\${locale}.json\`)).default;
}
`;

test("End-to-End: unsichere Importe werden gemeldet, geprüfte nicht", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sf-e2e-"));
  try {
    await mkdir(join(dir, "src"));
    await writeFile(join(dir, "src", "a.ts"), UNGESICHERT);
    await writeFile(join(dir, "src", "b.ts"), FEHLERHAFT);
    await writeFile(join(dir, "src", "c.ts"), KORREKT);

    const befunde = await runEslint(dir);
    const importe = befunde.filter((f) => f.message.includes("to import"));

    assert.ok(importe.some((f) => f.file === "src/a.ts" && f.line === 3), "src/a.ts:3 muss gemeldet werden");
    assert.ok(importe.some((f) => f.file === "src/b.ts" && f.line === 4), "src/b.ts:4 muss gemeldet werden");
    assert.ok(!importe.some((f) => f.file === "src/c.ts"), "src/c.ts darf nicht gemeldet werden");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
