import { test } from "node:test";
import assert from "node:assert/strict";
import { countSame } from "../src/verify.js";
import type { Finding } from "../src/types.js";

const f = (rule: string, file: string, line: number): Finding => ({
  id: "", source: "semgrep", rule, file, line, severity: "high", message: "m", fingerprint: `${rule}${line}`,
});

test("countSame zählt nur gleiche Regel in gleicher Datei", () => {
  const alle = [f("xss", "a.ts", 1), f("xss", "a.ts", 9), f("xss", "b.ts", 2), f("sqli", "a.ts", 3)];
  assert.equal(countSame(alle, f("xss", "a.ts", 1)), 2);
});
