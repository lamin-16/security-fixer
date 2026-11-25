import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fingerprint, parseSarif } from "./sarif.js";
import type { Finding, Severity } from "./types.js";

export interface ScanResult {
  findings: Finding[];
  /** Hinweise, z. B. wenn ein Werkzeug nicht installiert ist */
  warnings: string[];
}

/**
 * Startet ein externes Werkzeug ohne Shell.
 * Nicht-Null-Exitcodes sind bei Scannern normal (sie melden Befunde),
 * deshalb wird die Ausgabe immer zurückgegeben.
 */
function run(cmd: string, args: string[], cwd: string, timeout = 300_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd, timeout, maxBuffer: 64 * 1024 * 1024 }, (err, stdout) => {
      if (err && (err as NodeJS.ErrnoException).code === "ENOENT") {
        return reject(new Error(`${cmd} ist nicht installiert`));
      }
      resolve(stdout.toString());
    });
  });
}

export async function runSemgrep(dir: string, config: string): Promise<Finding[]> {
  const out = await run(
    "semgrep",
    ["scan", "--config", config, "--sarif", "--metrics=off", "--quiet", "."],
    dir,
  );
  return parseSarif(JSON.parse(out || "{}"), "semgrep");
}

export async function runNpmAudit(dir: string): Promise<Finding[]> {
  const out = await run("npm", ["audit", "--json"], dir);
  const data = JSON.parse(out || "{}") as {
    vulnerabilities?: Record<string, { name: string; severity: string; range?: string }>;
  };
  const map: Record<string, Severity> = {
    critical: "critical",
    high: "high",
    moderate: "medium",
    low: "low",
    info: "info",
  };

  return Object.values(data.vulnerabilities ?? {}).map((v) => ({
    id: "",
    source: "npm-audit" as const,
    rule: `npm-audit:${v.name}`,
    severity: map[v.severity] ?? "medium",
    message: `Abhängigkeit ${v.name} ist verwundbar (Bereich: ${v.range ?? "unbekannt"})`,
    file: "package.json",
    fingerprint: fingerprint("npm-audit", v.name),
  }));
}

export async function runGitleaks(dir: string): Promise<Finding[]> {
  const tmp = await mkdtemp(join(tmpdir(), "sf-"));
  const report = join(tmp, "gitleaks.sarif");
  try {
    await run(
      "gitleaks",
      [
        "detect",
        "--source", ".",
        "--no-git",
        "--no-banner",
        "--exit-code", "0",
        "--report-format", "sarif",
        "--report-path", report,
      ],
      dir,
    );
    const text = await readFile(report, "utf8").catch(() => "{}");
    return parseSarif(JSON.parse(text), "gitleaks").map((f) => ({
      ...f,
      severity: "high" as const,
      message: `Möglicher geheimer Schlüssel: ${f.rule}`,
    }));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

/** Führt alle Scanner aus. Fehlt ein Werkzeug, wird nur ein Hinweis erzeugt. */
export async function scanAll(dir: string, semgrepConfig: string): Promise<ScanResult> {
  const findings: Finding[] = [];
  const warnings: string[] = [];

  const steps: [string, () => Promise<Finding[]>][] = [
    ["semgrep", () => runSemgrep(dir, semgrepConfig)],
    ["npm-audit", () => runNpmAudit(dir)],
    ["gitleaks", () => runGitleaks(dir)],
  ];

  for (const [name, step] of steps) {
    try {
      findings.push(...(await step()));
    } catch (e) {
      warnings.push(`${name} übersprungen: ${(e as Error).message}`);
    }
  }
  return { findings, warnings };
}
