import { test } from "node:test";
import assert from "node:assert/strict";
import { parseReview, parseJsonLoose } from "../src/agents.js";

test("Zustimmung wird nur bei approved: true erkannt", () => {
  const v = parseReview('{"approved": true, "reason": "passt"}');
  assert.equal(v.approved, true);
});

test("approved als Text gilt als Ablehnung", () => {
  assert.equal(parseReview('{"approved": "yes"}').approved, false);
});

test("ungültiges JSON gilt als Ablehnung", () => {
  assert.equal(parseReview("das ist kein JSON").approved, false);
});

test("JSON in Markdown-Zaun wird gelesen", () => {
  const v = parseReview('```json\n{"approved": true, "reason": "ok"}\n```');
  assert.equal(v.approved, true);
});

test("parseJsonLoose liefert null bei Fehlern", () => {
  assert.equal(parseJsonLoose("{kaputt"), null);
});
