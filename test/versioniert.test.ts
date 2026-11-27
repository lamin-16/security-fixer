import { test } from "node:test";
import assert from "node:assert/strict";
import { istPlatzhalter, nurVersioniert } from "../src/versioniert.js";
import type { Finding } from "../src/types.js";

const fund = (file?: string): Finding => ({
  id: "", source: "gitleaks", rule: "generic-api-key", severity: "high", message: "m", file, fingerprint: file ?? "x",
});

test("Platzhalter-Zeilen werden erkannt", () => {
  assert.equal(istPlatzhalter('Authorization: Bearer mc_live_xxx'), true);
  assert.equal(istPlatzhalter('api_key: "YOUR_API_KEY_HERE"'), true);
  assert.equal(istPlatzhalter('token: "<dein-token>"'), true);
});

test("echte Schlüssel-Zeilen werden nicht als Platzhalter erkannt", () => {
  assert.equal(istPlatzhalter('const k = "a8fK29sLq0pZx7Mv3Rt1"'), false);
});

test("nicht versionierte Dateien werden entfernt", () => {
  const dateien = new Set(["src/a.ts"]);
  const { behalten, entfernt } = nurVersioniert([fund("src/a.ts"), fund(".env.local")], dateien);
  assert.equal(entfernt, 1);
  assert.equal(behalten.length, 1);
  assert.equal(behalten[0].file, "src/a.ts");
});

test("Befunde ohne Datei bleiben erhalten", () => {
  const { behalten } = nurVersioniert([fund(undefined)], new Set());
  assert.equal(behalten.length, 1);
});
