import { test } from "node:test";
import assert from "node:assert/strict";
import { triage } from "../src/triage.js";
import { levelToSeverity, parseSarif } from "../src/sarif.js";
import type { Finding } from "../src/types.js";

const befund = (fp: string, severity: Finding["severity"]): Finding => ({
  id: "",
  source: "semgrep",
  rule: "regel",
  severity,
  message: "Meldung",
  fingerprint: fp,
});

test("triage entfernt Duplikate und sortiert nach Schwere", () => {
  const ergebnis = triage([befund("a", "low"), befund("b", "critical"), befund("a", "low")]);
  assert.equal(ergebnis.length, 2);
  assert.equal(ergebnis[0].severity, "critical");
  assert.equal(ergebnis[0].id, "F-001");
});

test("triage filtert nach Mindestschwere", () => {
  const ergebnis = triage([befund("a", "info"), befund("b", "high")], "medium");
  assert.equal(ergebnis.length, 1);
  assert.equal(ergebnis[0].severity, "high");
});

test("SARIF wird korrekt gelesen", () => {
  const sarif = {
    runs: [
      {
        results: [
          {
            ruleId: "xss",
            level: "error",
            message: { text: "Mögliches XSS" },
            locations: [
              { physicalLocation: { artifactLocation: { uri: "src/a.ts" }, region: { startLine: 7 } } },
            ],
          },
        ],
      },
    ],
  };
  const [f] = parseSarif(sarif, "semgrep");
  assert.equal(f.severity, "high");
  assert.equal(f.file, "src/a.ts");
  assert.equal(f.line, 7);
});

test("Fehlende SARIF-Stufe wird als mittel behandelt", () => {
  assert.equal(levelToSeverity(undefined), "medium");
});
