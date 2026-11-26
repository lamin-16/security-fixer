import { test } from "node:test";
import assert from "node:assert/strict";
import { findeSkriptUrls, istExponierterPfad, pruefeCookie, pruefeHeader, pruefeJs } from "../src/passiv.js";

const base = "https://example.com/";

test("fehlende Sicherheitsheader werden gemeldet", () => {
  const regeln = pruefeHeader({}, base).map((f) => f.rule);
  assert.ok(regeln.includes("web/content-security-policy"));
  assert.ok(regeln.includes("web/strict-transport-security"));
});

test("vorhandene Header erzeugen keine Meldung für sie", () => {
  const regeln = pruefeHeader(
    { "content-security-policy": "default-src 'self'; frame-ancestors 'none'", "strict-transport-security": "max-age=1", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" },
    base,
  ).map((f) => f.rule);
  assert.deepEqual(regeln, []);
});

test("Cookie ohne Flags wird gemeldet", () => {
  const regeln = pruefeCookie("sid=abc; Path=/", base).map((f) => f.rule);
  assert.ok(regeln.includes("web/cookie-secure"));
  assert.ok(regeln.includes("web/cookie-httponly"));
});

test("Cookie mit allen Flags ist unauffällig", () => {
  assert.deepEqual(pruefeCookie("sid=abc; Path=/; Secure; HttpOnly; SameSite=Lax", base), []);
});

test("Skripte fremder Herkunft werden nicht gesammelt", () => {
  const html = '<script src="/a.js"></script><script src="https://other.org/x.js"></script>';
  assert.deepEqual(findeSkriptUrls(html, base), ["https://example.com/a.js"]);
});

test("Source-Map-Verweis wird erkannt", () => {
  const regeln = pruefeJs("var a=1;\n//# sourceMappingURL=a.js.map", "https://example.com/a.js").map((f) => f.rule);
  assert.ok(regeln.includes("web/sourcemap-verweis"));
});

test("eingebetteter AWS-Schlüssel wird erkannt, ohne ihn zu speichern", () => {
  const befunde = pruefeJs('const k="AKIAIOSFODNN7EXAMPLE";', "https://example.com/a.js");
  assert.ok(befunde.some((f) => f.rule === "web/geheimnis"));
  assert.ok(!befunde.some((f) => f.message.includes("AKIA")));
});

test("HTML-Antwort auf einem Pfad gilt nicht als exponiert", () => {
  assert.equal(istExponierterPfad(200, "text/html; charset=utf-8"), false);
  assert.equal(istExponierterPfad(404, "text/plain"), false);
  assert.equal(istExponierterPfad(200, "text/plain"), true);
});
