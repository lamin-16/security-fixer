import { test } from "node:test";
import assert from "node:assert/strict";
import type { ESLint } from "eslint";
import { eslintResultsToFindings } from "../src/eslint-scan.js";

const dir = "/tmp/repo";

test("ESLint-Meldungen werden zu Befunden mit relativem Pfad", () => {
  const results = [
    {
      filePath: "/tmp/repo/src/a.ts",
      messages: [{ ruleId: "security/detect-eval-with-expression", severity: 2, message: "eval", line: 3 }],
    },
  ] as unknown as ESLint.LintResult[];

  const [f] = eslintResultsToFindings(results, dir);
  assert.equal(f.source, "eslint");
  assert.equal(f.file, "src/a.ts");
  assert.equal(f.line, 3);
  assert.equal(f.severity, "high");
});

test("Warnungen werden als mittel eingestuft", () => {
  const results = [
    {
      filePath: "/tmp/repo/b.ts",
      messages: [{ ruleId: "no-unsanitized/property", severity: 1, message: "x", line: 1 }],
    },
  ] as unknown as ESLint.LintResult[];

  assert.equal(eslintResultsToFindings(results, dir)[0].severity, "medium");
});

test("Meldungen ohne Regel-ID werden übersprungen", () => {
  const results = [
    {
      filePath: "/tmp/repo/c.ts",
      messages: [{ ruleId: null, severity: 2, message: "Parse error", line: 1 }],
    },
  ] as unknown as ESLint.LintResult[];

  assert.equal(eslintResultsToFindings(results, dir).length, 0);
});
