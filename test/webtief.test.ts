import { test } from "node:test";
import assert from "node:assert/strict";
import { findeInternLinks, pruefeFormulare, pruefeGemischt, pruefeRobots, pruefeSri } from "../src/webtief.js";

const base = "https://example.com/";

test("interne Links werden gesammelt, externe nicht", () => {
  const html = '<a href="/ueber">a</a><a href="https://other.org/x">b</a><a href="/ueber#oben">c</a>';
  assert.deepEqual(findeInternLinks(html, base), ["https://example.com/ueber"]);
});

test("http-Ressource auf https-Seite wird gemeldet", () => {
  const regeln = pruefeGemischt('<img src="http://cdn.example.com/a.png">', base).map((f) => f.rule);
  assert.deepEqual(regeln, ["web/gemischte-inhalte"]);
});

test("https-Ressourcen werden nicht gemeldet", () => {
  assert.deepEqual(pruefeGemischt('<img src="https://cdn.example.com/a.png">', base), []);
});

test("externes Skript ohne integrity wird gemeldet", () => {
  const html = '<script src="https://cdn.other.org/lib.js"></script>';
  assert.equal(pruefeSri(html, base).length, 1);
});

test("externes Skript mit integrity ist in Ordnung", () => {
  const html = '<script src="https://cdn.other.org/lib.js" integrity="sha384-abc" crossorigin></script>';
  assert.deepEqual(pruefeSri(html, base), []);
});

test("Anmeldeformular mit http-Ziel wird als hoch gemeldet", () => {
  const html = '<form action="http://example.com/login"><input type="password"></form>';
  const f = pruefeFormulare(html, base);
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, "high");
});

test("Formular ohne Passwortfeld wird ignoriert", () => {
  assert.deepEqual(pruefeFormulare('<form action="http://x"><input type="text"></form>', base), []);
});

test("robots.txt zählt nur Disallow-Einträge mit Pfad", () => {
  const text = "User-agent: *\nDisallow: /admin\nDisallow:\nDisallow: /private\nAllow: /";
  const f = pruefeRobots(text, base);
  assert.equal(f.length, 1);
  assert.match(f[0].message, /2 gesperrte Pfade/);
});
