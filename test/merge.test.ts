import { test } from "node:test";
import assert from "node:assert/strict";
import { triage, zusammenfuehren } from "../src/triage.js";
import type { Finding } from "../src/types.js";

const basis: Finding = {
  id: "",
  source: "eslint",
  rule: "no-unsanitized/property",
  severity: "high",
  message: "Unsafe assignment to innerHTML",
  file: "x.ts",
  line: 5,
  fingerprint: "a",
};

test("gleiche Stelle aus zwei ESLint-Regeln wird ein Befund", () => {
  const zweite: Finding = { ...basis, rule: "sicherheit/xss-dom", message: "Mögliches XSS", fingerprint: "b" };
  const ergebnis = zusammenfuehren([basis, zweite]);
  assert.equal(ergebnis.length, 1);
  assert.match(ergebnis[0].rule, /no-unsanitized\/property/);
  assert.match(ergebnis[0].rule, /sicherheit\/xss-dom/);
});

test("verschiedene Zeilen bleiben getrennt", () => {
  const andere: Finding = { ...basis, line: 9, fingerprint: "c" };
  assert.equal(zusammenfuehren([basis, andere]).length, 2);
});

test("Befunde anderer Quellen werden nicht zusammengeführt", () => {
  const semgrep: Finding = { ...basis, source: "semgrep", rule: "sicherheit/xss-dom", fingerprint: "d" };
  assert.equal(zusammenfuehren([basis, semgrep]).length, 2);
});

test("triage liefert die Zusammenfassung ohne doppelte Meldung", () => {
  const zweite: Finding = { ...basis, rule: "sicherheit/xss-dom", fingerprint: "b" };
  const ergebnis = triage([basis, zweite]);
  assert.equal(ergebnis.length, 1);
  assert.equal(ergebnis[0].id, "F-001");
});
