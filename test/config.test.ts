import { test } from "node:test";
import assert from "node:assert/strict";
import { filterExcluded, globToRegex } from "../src/config.js";
import type { Finding } from "../src/types.js";

const befund = (file?: string): Finding => ({
  id: "",
  source: "gitleaks",
  rule: "regel",
  severity: "high",
  message: "m",
  file,
  fingerprint: file ?? "ohne-datei",
});

test("** am Ende erfasst beliebig tiefe Pfade", () => {
  const re = globToRegex("test/**");
  assert.ok(re.test("test/api/x.ts"));
  assert.ok(!re.test("tests/x.ts"));
});

test("**/ erfasst auch Dateien direkt im Wurzelverzeichnis", () => {
  const re = globToRegex("**/*.spec.ts");
  assert.ok(re.test("a.spec.ts"));
  assert.ok(re.test("frontend/src/a.spec.ts"));
  assert.ok(!re.test("a.ts"));
});

test("* überschreitet keine Ordnergrenze", () => {
  const re = globToRegex("src/*.ts");
  assert.ok(re.test("src/a.ts"));
  assert.ok(!re.test("src/x/a.ts"));
});

test("filterExcluded trennt Befunde und zählt die Ausschlüsse", () => {
  const { behalten, ausgeschlossen } = filterExcluded(
    [befund("test/a.ts"), befund("src/b.ts"), befund()],
    [{ muster: "test/**", grund: "Testdaten" }],
  );
  assert.equal(ausgeschlossen, 1);
  assert.equal(behalten.length, 2);
});

test("Befunde ohne Datei werden nie ausgeschlossen", () => {
  const { behalten } = filterExcluded([befund()], [{ muster: "**", grund: "alles" }]);
  assert.equal(behalten.length, 1);
});
