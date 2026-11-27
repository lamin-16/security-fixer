import { test } from "node:test";
import assert from "node:assert/strict";
import { Linter } from "eslint";
import { gesicherteImporte, sicherheitsPlugin } from "../src/regeln.js";
import { eslintResultsToFindings } from "../src/eslint-scan.js";

const linter = new Linter({ configType: "flat" });
const config = [
  {
    files: ["**/*.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
    plugins: { sicherheit: sicherheitsPlugin },
    rules: { "sicherheit/gesicherter-import": "error" },
  },
];

const geprueft = `
import { hasLocale } from "next-intl";
export async function laden(requested, routing) {
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return (await import(\`../../messages/\${locale}.json\`)).default;
}`;

const ungeprueft = `
export async function laden(req) {
  const name = req.query.lang;
  return (await import(\`../messages/\${name}.json\`)).default;
}`;

test("Import mit hasLocale-Prüfung wird als gesichert erkannt", () => {
  gesicherteImporte.clear();
  linter.verify(geprueft, config as any, "geprueft.js");
  assert.ok(gesicherteImporte.get("geprueft.js")?.has(5), "Zeile 5 erwartet");
});

test("Import ohne Prüfung wird nicht als gesichert erkannt", () => {
  gesicherteImporte.clear();
  linter.verify(ungeprueft, config as any, "ungeprueft.js");
  assert.equal(gesicherteImporte.get("ungeprueft.js"), undefined);
});

test("gesicherter Import wird aus den Befunden entfernt", () => {
  const datei = "/tmp/repo/src/i18n/request.ts";
  const map = new Map([[datei, new Set([14])]]);
  const results = [
    {
      filePath: datei,
      messages: [
        { ruleId: "no-unsanitized/method", severity: 2, message: "Unsafe call to import for argument 0", line: 14 },
      ],
    },
  ] as any;
  assert.equal(eslintResultsToFindings(results, "/tmp/repo", map).length, 0);
});

test("ungesicherter Import bleibt als Befund erhalten", () => {
  const datei = "/tmp/repo/src/x.ts";
  const results = [
    {
      filePath: datei,
      messages: [
        { ruleId: "no-unsanitized/method", severity: 2, message: "Unsafe call to import for argument 0", line: 9 },
      ],
    },
  ] as any;
  assert.equal(eslintResultsToFindings(results, "/tmp/repo", new Map()).length, 1);
});

test("Prüfung auf einen anderen Wert als den verwendeten gilt nicht als gesichert", () => {
  gesicherteImporte.clear();
  const fehlerhaft = `
const erlaubt = ['de', 'en'];
export async function laden(sprache, roh) {
  const locale = erlaubt.includes(sprache) ? roh : 'de';
  return (await import(\`../messages/\${locale}.json\`)).default;
}`;
  linter.verify(fehlerhaft, config as any, "fehlerhaft.js");
  assert.equal(gesicherteImporte.get("fehlerhaft.js")?.has(5) ?? false, false);
});

test("Prüfung auf den verwendeten Wert gilt als gesichert", () => {
  gesicherteImporte.clear();
  const korrekt = `
const erlaubt = ['de', 'en'];
export async function laden(sprache) {
  const locale = erlaubt.includes(sprache) ? sprache : 'de';
  return (await import(\`../messages/\${locale}.json\`)).default;
}`;
  linter.verify(korrekt, config as any, "korrekt.js");
  assert.ok(gesicherteImporte.get("korrekt.js")?.has(5));
});
