import { test } from "node:test";
import assert from "node:assert/strict";
import { istUnterdrueckt } from "../src/suppress.js";

test("Unterdrückung mit Begründung wirkt", () => {
  const zeile = "// sicherheitsfixer-ignore: sicherheit/sql-injection -- Eingabe ist geprüft";
  assert.equal(istUnterdrueckt(zeile, "sicherheit/sql-injection"), true);
});

test("Unterdrückung ohne Begründung wirkt nicht", () => {
  const zeile = "// sicherheitsfixer-ignore: sicherheit/sql-injection";
  assert.equal(istUnterdrueckt(zeile, "sicherheit/sql-injection"), false);
});

test("Unterdrückung einer anderen Regel wirkt nicht", () => {
  const zeile = "// sicherheitsfixer-ignore: sicherheit/xss-dom -- geprüft";
  assert.equal(istUnterdrueckt(zeile, "sicherheit/sql-injection"), false);
});

test("Stern unterdrückt alle Regeln", () => {
  const zeile = "// sicherheitsfixer-ignore: * -- generierter Code";
  assert.equal(istUnterdrueckt(zeile, "security/detect-eval-with-expression"), true);
});

test("zusammengeführte Regel wird über ihre erste Regel erkannt", () => {
  const zeile = "// sicherheitsfixer-ignore: no-unsanitized/property -- Quelle ist fest";
  assert.equal(istUnterdrueckt(zeile, "no-unsanitized/property + sicherheit/xss-dom"), true);
});
