import { ESLint, type Linter } from "eslint";
import tsParser from "@typescript-eslint/parser";
import security from "eslint-plugin-security";
import noUnsanitized from "eslint-plugin-no-unsanitized";
import { relative } from "node:path";
import { fingerprint } from "./sarif.js";
import { sicherheitsPlugin } from "./regeln.js";
import type { Finding } from "./types.js";

/**
 * Pfade, die nicht geprüft werden:
 * - Build-Ausgaben und Abhängigkeiten
 * - minifizierte Dateien
 * - Dritt-Bibliotheken (vendor, assets/private), die nicht zum Projekt gehören
 */
const IGNORIERT = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.next/**",
  "**/.turbo/**",
  "**/out/**",
  "**/releases/**",
  "**/build/**",
  "**/coverage/**",
  "**/*.min.js",
  "**/vendor/**",
  "**/assets/private/**",
];

/**
 * Regeln, die in TypeScript-Projekten vor allem Fehlalarme erzeugen.
 * Sie sind deaktiviert, damit der Bericht lesbar bleibt.
 */
const LAERM_REGELN: Record<string, "off"> = {
  "security/detect-object-injection": "off",
  "security/detect-non-literal-fs-filename": "off",
};

/** Konfiguration für ESLint, unabhängig von der Konfiguration des gescannten Projekts. */
export function buildConfig(): Linter.Config[] {
  const sicherheitsRegeln = security.configs?.recommended?.rules ?? {};
  return [
    { ignores: IGNORIERT },
    {
      files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.mjs", "**/*.cjs"],
      languageOptions: {
        parser: tsParser,
        ecmaVersion: 2022,
        sourceType: "module",
      },
      plugins: {
        security,
        "no-unsanitized": noUnsanitized,
        sicherheit: sicherheitsPlugin,
      },
      rules: {
        ...sicherheitsRegeln,
        ...LAERM_REGELN,
        "no-unsanitized/method": "error",
        "no-unsanitized/property": "error",
        "sicherheit/sql-injection": "error",
        "sicherheit/xss-dom": "error",
        "sicherheit/xss-reflected": "error",
      },
    },
  ];
}

/** Meldung, die entsteht, wenn eine eslint-disable-Zeile auf eine nicht geladene Regel verweist. */
const KONFIG_FEHLER = /Definition for rule '.+' was not found/;

/** Wandelt ESLint-Ergebnisse in normalisierte Befunde um. Reine Funktion, daher testbar. */
export function eslintResultsToFindings(results: ESLint.LintResult[], dir: string): Finding[] {
  const befunde: Finding[] = [];

  for (const r of results) {
    const file = relative(dir, r.filePath).split("\\").join("/");
    for (const m of r.messages) {
      // Meldungen ohne Regel-ID sind Syntaxfehler und keine Sicherheitsbefunde.
      if (!m.ruleId) continue;
      // Fehler in der Konfiguration der geprüften Datei sind keine Ergebnisse.
      if (KONFIG_FEHLER.test(m.message)) continue;

      befunde.push({
        id: "",
        source: "eslint",
        rule: m.ruleId,
        severity: m.severity === 2 ? "high" : "medium",
        message: m.message,
        file,
        line: m.line,
        fingerprint: fingerprint("eslint", m.ruleId, file, m.line),
      });
    }
  }
  return befunde;
}

export async function runEslint(dir: string): Promise<Finding[]> {
  const eslint = new ESLint({
    cwd: dir,
    overrideConfigFile: true,
    overrideConfig: buildConfig(),
    errorOnUnmatchedPattern: false,
  });
  const results = await eslint.lintFiles(["."]);
  return eslintResultsToFindings(results, dir);
}
