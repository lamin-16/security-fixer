import { test } from "node:test";
import assert from "node:assert/strict";
import { Linter, type ESLint } from "eslint";
import { sicherheitsPlugin } from "../src/regeln.js";
import { eslintResultsToFindings } from "../src/eslint-scan.js";

const linter = new Linter({ configType: "flat" });
const config = [
  {
    files: ["**/*.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
    plugins: { sicherheit: sicherheitsPlugin },
    rules: {
      "sicherheit/sql-injection": "error",
      "sicherheit/xss-dom": "error",
      "sicherheit/xss-reflected": "error",
    },
  },
];

function regeln(code: string): string[] {
  return linter.verify(code, config as any, "test.js").map((m) => m.ruleId ?? "");
}

test("SQL mit eingesetztem Wert wird erkannt", () => {
  const code = "db.query(`SELECT * FROM users WHERE email = '${email}'`);";
  assert.deepEqual(regeln(code), ["sicherheit/sql-injection"]);
});

test("SQL mit Platzhaltern wird nicht gemeldet", () => {
  const code = 'db.query("SELECT * FROM users WHERE email = ?", [email]);';
  assert.deepEqual(regeln(code), []);
});

test("SQL durch Textverkettung wird erkannt", () => {
  const code = 'db.query("SELECT * FROM users WHERE id = " + id);';
  assert.deepEqual(regeln(code), ["sicherheit/sql-injection"]);
});

test("innerHTML mit unbekanntem Wert wird erkannt", () => {
  assert.deepEqual(regeln("el.innerHTML = userInput;"), ["sicherheit/xss-dom"]);
});

test("innerHTML mit festem Text wird nicht gemeldet", () => {
  assert.deepEqual(regeln('el.innerHTML = "<b>hallo</b>";'), []);
});

test("reflektierte Eingabe aus der Anfrage wird erkannt", () => {
  const code = "res.send(`<h1>${req.query.name}</h1>`);";
  assert.deepEqual(regeln(code), ["sicherheit/xss-reflected"]);
});

test("ESLint-Konfigurationsfehler werden nicht als Befund gezählt", () => {
  const results = [
    {
      filePath: "/tmp/repo/a.ts",
      messages: [
        { ruleId: "@typescript-eslint/no-unused-vars", severity: 2, message: "Definition for rule '@typescript-eslint/no-unused-vars' was not found.", line: 1 },
        { ruleId: "security/detect-eval-with-expression", severity: 2, message: "eval", line: 2 },
      ],
    },
  ] as unknown as ESLint.LintResult[];

  const befunde = eslintResultsToFindings(results, "/tmp/repo");
  assert.equal(befunde.length, 1);
  assert.equal(befunde[0].rule, "security/detect-eval-with-expression");
});
