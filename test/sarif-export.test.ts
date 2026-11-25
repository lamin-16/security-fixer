import { test } from "node:test";
import assert from "node:assert/strict";
import { berichtAlsSarif, primaerRegel } from "../src/sarif-export.js";
import type { Finding } from "../src/types.js";

const befund: Finding = {
  id: "F-001",
  source: "eslint",
  rule: "sicherheit/sql-injection",
  severity: "high",
  message: "SQL",
  file: "routes/login.ts",
  line: 34,
  fingerprint: "abc",
};

test("SARIF hat Version 2.1.0 und ein Lauf-Objekt", () => {
  const s = berichtAlsSarif([befund], "0.5.0") as any;
  assert.equal(s.version, "2.1.0");
  assert.equal(s.runs.length, 1);
  assert.equal(s.runs[0].tool.driver.name, "Sicherheitsfixer");
});

test("Schwere wird auf SARIF-Stufen abgebildet", () => {
  const s = berichtAlsSarif(
    [befund, { ...befund, severity: "medium" }, { ...befund, severity: "low" }],
    "0.5.0",
  ) as any;
  assert.deepEqual(s.runs[0].results.map((r: any) => r.level), ["error", "warning", "note"]);
});

test("Ort mit Datei und Zeile wird übernommen", () => {
  const s = berichtAlsSarif([befund], "0.5.0") as any;
  const ort = s.runs[0].results[0].locations[0].physicalLocation;
  assert.equal(ort.artifactLocation.uri, "routes/login.ts");
  assert.equal(ort.region.startLine, 34);
});

test("Befund ohne Datei enthält keinen Ort", () => {
  const s = berichtAlsSarif([{ ...befund, file: undefined, line: undefined }], "0.5.0") as any;
  assert.equal(s.runs[0].results[0].locations, undefined);
});

test("zusammengeführte Regel wird auf die erste Regel gekürzt", () => {
  assert.equal(primaerRegel("a/b + c/d"), "a/b");
});
