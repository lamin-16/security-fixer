#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { assertCleanTree, assertRepo, safeFilePath } from "./guard.js";
import { audit } from "./audit.js";
import { createBranch, commitFiles, diffStat } from "./git.js";
import { proposeFix } from "./fixer.js";
import { reviewProposal } from "./agents.js";
import { berichtAlsMarkdown } from "./report.js";
import { berichtAlsSarif } from "./sarif-export.js";
import { bewerte, berichtBenchmark, type Wahrheit } from "./benchmark.js";
import { scanWeb } from "./passiv.js";
import { scanWebTief } from "./webtief.js";
import { scanAll } from "./scanners.js";
import { triage } from "./triage.js";
import { countSame, verifyFix } from "./verify.js";
import type { Finding, Severity } from "./types.js";

const args = process.argv.slice(2);
const befehl = args[0];
const ziel = args[1];

function option(name: string, standard?: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : standard;
}

const SEMGREP_CONFIG = option("--semgrep-config", "p/typescript")!;
const MODELL = option("--modell", "claude-sonnet-5-5")!;
const MAX = Number(option("--max", "5"));
const MIN = option("--min", "low") as Severity;
const TROCKEN = args.includes("--trocken");
const AGENTEN = args.includes("--agenten");

function hilfe(): void {
  console.log(`Sicherheitsfixer 0.11.2

Befehle:
  scan <repo>   Scannt ein Repository und erstellt einen Bericht
  fix  <repo>   Schlägt Korrekturen vor, prüft sie und legt sie in einem Branch ab

Optionen:
  --min <stufe>            critical | high | medium | low | info (Standard: low)
  --bericht <datei>        Bericht in eine Datei schreiben (nur scan)
  --sarif <datei>          Befunde als SARIF 2.1.0 schreiben (nur scan)
  --json <datei>           Befunde als JSON schreiben (nur scan)
  --fehler-ab <stufe>      Exit-Code 1, wenn Befunde ab dieser Stufe vorliegen (nur scan)
  --alle-dateien           Auch nicht versionierte Dateien prüfen (nur scan)
  --max <zahl>             Maximale Anzahl Korrekturen (nur fix, Standard: 5)
  --modell <name>          Modell für Korrekturen (nur fix)
  --semgrep-config <cfg>   Semgrep-Regelsatz (Standard: p/typescript)
  --trocken                Korrekturen nur prüfen, nichts speichern (nur fix)
  --agenten                Unabhängiger Reviewer prüft jede Korrektur (nur fix)
  --commit                 Nach Prüfung und Bestätigung committen (nur fix)

Umgebung:
  ANTHROPIC_API_KEY        Erforderlich für fix`);
}

async function scanLauf(repo: string): Promise<void> {
  const { findings: roh, warnings } = await scanAll(repo, SEMGREP_CONFIG, !args.includes("--alle-dateien"));
  const findings = triage(roh, MIN);
  await audit({ aktion: "scan", repo, befunde: findings.length });

  const jsonDatei = option("--json");
  if (jsonDatei) {
    await writeFile(jsonDatei, JSON.stringify(findings, null, 2), "utf8");
    console.log(`JSON geschrieben: ${jsonDatei}`);
  }

  const sarifDatei = option("--sarif");
  if (sarifDatei) {
    await writeFile(sarifDatei, JSON.stringify(berichtAlsSarif(findings, "0.11.2"), null, 2), "utf8");
    console.log(`SARIF geschrieben: ${sarifDatei}`);
  }

  const bericht = berichtAlsMarkdown(findings, warnings, new Date());
  const datei = option("--bericht");
  if (datei) {
    await writeFile(datei, bericht, "utf8");
    console.log(`Bericht geschrieben: ${datei}`);
  } else {
    console.log(bericht);
  }

  const grenze = option("--fehler-ab");
  if (grenze) {
    const rang: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    if (!(grenze in rang)) {
      throw new Error(`Unbekannte Stufe für --fehler-ab: ${grenze}`);
    }
    if (findings.some((f) => rang[f.severity] <= rang[grenze])) {
      console.error(`Schwelle erreicht: Befunde mit Schwere ${grenze} oder höher vorhanden.`);
      process.exitCode = 1;
    }
  }
}

async function fixLauf(repo: string): Promise<void> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY ist nicht gesetzt.");

  await assertCleanTree(repo);

  const { findings: roh } = await scanAll(repo, SEMGREP_CONFIG);
  const kandidaten: Finding[] = triage(roh, MIN)
    .filter((f) => (f.source === "semgrep" || f.source === "eslint") && f.file)
    .slice(0, MAX);

  if (kandidaten.length === 0) {
    console.log("Keine automatisch korrigierbaren Befunde. Automatisch korrigiert werden nur Befunde von ESLint und Semgrep mit Datei.");
    return;
  }

  let branch: string | undefined;
  if (!TROCKEN) {
    branch = `sicherheitsfixer/${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;
    await createBranch(repo, branch);
  }

  const angewendet: { finding: Finding; file: string; erklaerung: string }[] = [];

  for (const f of kandidaten) {
    const pfad = safeFilePath(repo, f.file!);
    const original = await readFile(pfad, "utf8").catch(() => null);
    if (original === null) continue;

    const vorschlag = await proposeFix(f, original, { apiKey: key, model: MODELL });
    if (!vorschlag) {
      await audit({ aktion: "kein-vorschlag", befund: f.rule, datei: f.file });
      console.log(`– ${f.id} ${f.rule}: kein sicherer Vorschlag`);
      continue;
    }

    if (AGENTEN) {
      const pruefung = await reviewProposal(f, original, vorschlag.newContent, { apiKey: key, model: MODELL });
      await audit({ aktion: "reviewer", befund: f.rule, datei: f.file, genehmigt: pruefung.approved, grund: pruefung.reason });
      if (!pruefung.approved) {
        console.log(`↩️ ${f.id} vom Reviewer abgelehnt: ${pruefung.reason}`);
        continue;
      }
    }

    const vorherAnzahl = countSame(roh, f);
    await writeFile(pfad, vorschlag.newContent, "utf8");
    const urteil = await verifyFix(repo, f, SEMGREP_CONFIG, vorherAnzahl);
    await audit({ aktion: "pruefung", befund: f.rule, datei: f.file, bestanden: urteil.ok, gruende: urteil.reasons, trocken: TROCKEN });

    if (urteil.ok) {
      angewendet.push({ finding: f, file: f.file!, erklaerung: vorschlag.explanation });
      console.log(`✅ ${f.id} ${f.rule} in ${f.file}`);
    } else {
      console.log(`❌ ${f.id} verworfen: ${urteil.reasons.join(", ")}`);
    }

    // Im Trockenlauf wird jede Änderung nach der Prüfung zurückgenommen.
    // Bei einem echten Lauf bleibt sie bestehen, wenn sie bestanden hat.
    if (!urteil.ok || TROCKEN) await writeFile(pfad, original, "utf8");
  }

  if (angewendet.length === 0) {
    console.log("Keine Korrektur hat die Prüfung bestanden.");
    return;
  }

  if (TROCKEN) {
    console.log(`\nTrockenlauf: ${angewendet.length} Korrektur(en) wären möglich. Es wurde nichts gespeichert.`);
    for (const a of angewendet) console.log(`- ${a.finding.id}: ${a.erklaerung}`);
    return;
  }

  console.log("\nÄnderungen:");
  console.log(await diffStat(repo));
  console.log("Erklärungen:");
  for (const a of angewendet) console.log(`- ${a.finding.id}: ${a.erklaerung}`);

  if (!args.includes("--commit")) {
    console.log(`\nDie Änderungen liegen im Branch ${branch}. Prüfen mit "git diff", committen mit --commit.`);
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const antwort = await rl.question(`\n${angewendet.length} Korrekturen committen? (ja/nein) `);
  rl.close();

  if (antwort.trim().toLowerCase() !== "ja") {
    console.log(`Abgebrochen. Die Änderungen bleiben unkommittiert im Branch ${branch}.`);
    return;
  }

  const dateien = [...new Set(angewendet.map((a) => a.file))];
  await commitFiles(repo, dateien, `fix: ${angewendet.length} Sicherheitsbefunde behoben (automatisch vorgeschlagen, geprüft)`);
  await audit({ aktion: "commit", branch, dateien });
  console.log(`Commit im Branch ${branch} erstellt.`);
}

async function benchmarkLauf(repo: string): Promise<void> {
  const wahrheitDatei = option("--wahrheit");
  if (!wahrheitDatei) throw new Error("Bitte --wahrheit <datei> angeben.");

  const wahrheit = JSON.parse(await readFile(wahrheitDatei, "utf8")) as Wahrheit[];
  if (!Array.isArray(wahrheit)) throw new Error("Die Wahrheitsdatei muss eine Liste sein.");

  const { findings: roh } = await scanAll(repo, SEMGREP_CONFIG);
  const findings = triage(roh, "low");
  console.log(berichtBenchmark(bewerte(findings, wahrheit), new Date()));
}

async function webLauf(): Promise<void> {
  if (!ziel) throw new Error("Bitte eine Adresse angeben, z. B. https://beispiel.de");
  if (!args.includes("--ich-besitze-es")) {
    throw new Error("Bestätigung fehlt. Fügen Sie --ich-besitze-es hinzu, wenn Ihnen diese Website gehört.");
  }

  const tief = args.includes("--tief");
  const ergebnis = tief ? await scanWebTief(ziel) : await scanWeb(ziel);
  const { findings, anfragen, warnings } = ergebnis;
  const befunde = triage(findings, "low");
  const modus = tief ? "tiefe passive Prüfung" : "passive Prüfung";
  const seiten = "seiten" in ergebnis ? `, ${ergebnis.seiten} Seiten geprüft` : "";
  const hinweise = [...warnings, `${modus}: ${anfragen} Anfragen gesendet${seiten} (nur GET, keine Dateiinhalte gespeichert)`];
  console.log(berichtAlsMarkdown(befunde, hinweise, new Date()));
}

async function main(): Promise<void> {
  if (!befehl || befehl === "--hilfe" || !ziel) {
    hilfe();
    return;
  }

  if (befehl === "web") return webLauf();

  const repo = await assertRepo(ziel);

  if (befehl === "scan") return scanLauf(repo);
  if (befehl === "fix") return fixLauf(repo);
  if (befehl === "benchmark") return benchmarkLauf(repo);

  hilfe();
}

main().catch((e: Error) => {
  console.error(`Fehler: ${e.message}`);
  process.exit(1);
});
