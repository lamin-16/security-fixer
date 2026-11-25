import { test } from "node:test";
import assert from "node:assert/strict";
import { safeFilePath } from "../src/guard.js";

test("Pfade außerhalb des Repositories werden verweigert", () => {
  assert.throws(() => safeFilePath("/tmp/repo", "../etc/passwd"));
});

test("absolute Pfade werden verweigert", () => {
  assert.throws(() => safeFilePath("/tmp/repo", "/etc/passwd"));
});

test("geschützte Dateien werden verweigert", () => {
  assert.throws(() => safeFilePath("/tmp/repo", ".env"));
  assert.throws(() => safeFilePath("/tmp/repo", "node_modules/x/index.js"));
  assert.throws(() => safeFilePath("/tmp/repo", ".git/config"));
});

test("normale Dateien im Repository sind erlaubt", () => {
  assert.equal(safeFilePath("/tmp/repo", "src/app.ts"), "/tmp/repo/src/app.ts");
});
