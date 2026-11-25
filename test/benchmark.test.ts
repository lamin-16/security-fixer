import { test } from "node:test";
import assert from "node:assert/strict";
import { bewerte, kategorieVon, type Wahrheit } from "../src/benchmark.js";
import type { Finding } from "../src/types.js";

const fund = (rule: string, file: string, line?: number): Finding => ({
  id: "", source: "eslint", rule, severity: "high", message: "m", file, line, fingerprint: `${rule}${file}${line}`,
});

const sql: Wahrheit = { id: "W-1", file: "routes/login.ts", kategorie: "sql", beschreibung: "Login" };

test("Kategorien werden richtig zugeordnet", () => {
  assert.equal(kategorieVon("sicherheit/sql-injection"), "sql");
  assert.equal(kategorieVon("no-unsanitized/property + sicherheit/xss-dom"), "xss");
  assert.equal(kategorieVon("generic-api-key"), "geheimnis");
  assert.equal(kategorieVon("security/detect-eval-with-expression"), "codeausfuehrung");
});

test("bekannte Schwachstelle wird gefunden", () => {
  const e = bewerte([fund("sicherheit/sql-injection", "routes/login.ts", 34)], [sql]);
  assert.equal(e.recall, 1);
  assert.equal(e.precision, 1);
});

test("nicht gefundene Schwachstelle zählt als verpasst", () => {
  const e = bewerte([], [sql]);
  assert.equal(e.recall, 0);
  assert.equal(e.verpasst.length, 1);
  assert.equal(e.precision, null);
});

test("zusätzlicher Befund in gleicher Kategorie ist ein Fehlalarm", () => {
  const e = bewerte(
    [fund("sicherheit/sql-injection", "routes/login.ts", 34), fund("sicherheit/sql-injection", "routes/other.ts", 5)],
    [sql],
  );
  assert.equal(e.fehlalarme, 1);
  assert.equal(e.precision, 0.5);
});

test("andere Kategorie in derselben Datei passt nicht", () => {
  const e = bewerte([fund("no-unsanitized/property", "routes/login.ts", 34)], [sql]);
  assert.equal(e.gefunden, 0);
});

test("Zeilentoleranz ist drei Zeilen", () => {
  const w: Wahrheit = { ...sql, line: 10 };
  assert.equal(bewerte([fund("sicherheit/sql-injection", "routes/login.ts", 12)], [w]).gefunden, 1);
  assert.equal(bewerte([fund("sicherheit/sql-injection", "routes/login.ts", 20)], [w]).gefunden, 0);
});
