<p align="center">
  <img src="assets/banner.svg" alt="Sicherheitsfixer" width="100%" />
</p>

<h1 align="center">🛡️ Sicherheitsfixer</h1>

<p align="center">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-D4AF37?style=for-the-badge&logo=typescript&logoColor=0b0b0b&labelColor=0b0b0b">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-%E2%89%A5%2020-D4AF37?style=for-the-badge&logo=nodedotjs&logoColor=0b0b0b&labelColor=0b0b0b">
  <img alt="Lizenz" src="https://img.shields.io/badge/Lizenz-MIT-D4AF37?style=for-the-badge&labelColor=0b0b0b">
  <img alt="Status" src="https://img.shields.io/badge/Status-Prototyp-D4AF37?style=for-the-badge&labelColor=0b0b0b">
  <img alt="SARIF" src="https://img.shields.io/badge/SARIF-2.1.0-D4AF37?style=for-the-badge&labelColor=0b0b0b">
</p>

<p align="center"><b>Findet Sicherheitslücken in TypeScript-Projekten und schlägt geprüfte Korrekturen vor. Ohne Ihre Zustimmung wird nichts committet.</b></p>

---

## Inhalt

- [Warum es das gibt](#warum-es-das-gibt)
- [So funktioniert es](#so-funktioniert-es)
- [Funktionen](#funktionen)
- [Installation](#installation)
- [Verwendung](#verwendung)
- [Sicherheitsgrenzen](#sicherheitsgrenzen)
- [Konfiguration](#konfiguration)
- [Testlauf mit OWASP Juice Shop](#testlauf-mit-owasp-juice-shop)
- [Entwicklung](#entwicklung)
- [Roadmap](#roadmap)
- [Lizenz](#lizenz)

---

## Warum es das gibt

Die meisten Sicherheitslücken entstehen nicht aus Unwissen, sondern aus Routine: ein fehlender Rechtecheck, eine veraltete Abhängigkeit, ein Schlüssel, der versehentlich ins Repository rutscht.

Sicherheitsfixer übernimmt diese Routine. Er sammelt Befunde, bereinigt sie, schlägt minimale Korrekturen vor und prüft jede davon, bevor Sie sie sehen.

## So funktioniert es

```mermaid
flowchart LR
  A["📁 Repository"] --> B["🔍 Scan<br/>Semgrep · npm audit · Gitleaks"]
  B --> C["🧹 Triage<br/>Duplikate entfernen, sortieren"]
  C --> D["🤖 Vorschlag<br/>minimale Änderung pro Befund"]
  D --> E{"✅ Prüfung<br/>Befund weg · Typen · Tests"}
  E -- bestanden --> F["🌿 Branch<br/>Änderung bereit"]
  E -- nicht bestanden --> G["↩️ Verworfen<br/>wird protokolliert"]
  F --> H{"👤 Ihre Bestätigung"}
  H -- ja --> I["📝 Commit"]
  H -- nein --> J["Nur Branch, nichts committet"]
```

## Funktionen

| | Funktion | Beschreibung |
|---|---|---|
| 🔍 | **Mehrere Scanner** | Semgrep für Code, `npm audit` für Abhängigkeiten, Gitleaks für geheime Schlüssel |
| 🧹 | **Triage** | Entfernt doppelte Befunde und sortiert nach Schweregrad |
| 📊 | **Bericht auf Deutsch** | Übersichtlicher Markdown-Bericht mit Zusammenfassung |
| 🤖 | **Minimale Korrekturen** | Das Modell ändert nur die betroffene Datei und nur die nötige Stelle |
| ✅ | **Prüfung vor Anzeige** | Befund muss verschwinden, TypeScript muss kompilieren, Tests müssen laufen |
| 🌿 | **Eigener Branch** | Änderungen landen nie direkt im Hauptzweig |
| 📜 | **Protokoll** | Jede Entscheidung wird mit Zeitstempel gespeichert |

## Installation

**Voraussetzungen**

- Node.js 20 oder neuer
- Git
- [Semgrep](https://semgrep.dev) (`pipx install semgrep`)
- [Gitleaks](https://github.com/gitleaks/gitleaks) (optional, aber empfohlen)
- Ein API-Schlüssel für `fix`

```bash
git clone https://github.com/lamin-16/security-fixer.git
cd security-fixer
npm install
npm run build
npm test
```

> **Termux:** Semgrep lässt sich über pip installieren. Gitleaks ist für Android nicht fertig gebaut und muss manuell kompiliert werden. Fehlt ein Werkzeug, überspringt das Tool es und meldet einen Hinweis.

## Verwendung

**1. Scannen und Bericht erstellen**

```bash
node dist/cli.js scan ./mein-projekt --bericht bericht.md
```

**2. Korrekturen vorschlagen und prüfen lassen**

```bash
export ANTHROPIC_API_KEY=ihr-schluessel
node dist/cli.js fix ./mein-projekt --max 5
```

Das Ergebnis liegt in einem neuen Branch `sicherheitsfixer/...`. Prüfen Sie die Änderungen mit `git diff`.

**3. Committen (mit Bestätigung)**

```bash
node dist/cli.js fix ./mein-projekt --commit
```

## Agenten-Modus

Mit `--agenten` prüft ein zweiter, unabhängiger Agent jede Korrektur, bevor sie angewendet wird.

```bash
node dist/cli.js fix ./mein-projekt --agenten
```

Die Pipeline besteht aus drei Stufen:

1. **Fixer** schlägt eine minimale Korrektur vor.
2. **Reviewer** prüft sie kritisch und lehnt sie im Zweifel ab. Ein Fehler oder eine unklare Antwort gilt als Ablehnung.
3. **Verifier** führt die deterministische Prüfung aus: Befund-Zählung, TypeScript und Tests. Das letzte Wort hat immer der Verifier.

Jede Entscheidung aller drei Stufen steht im Protokoll.

## Sicherheitsgrenzen

Dieses Tool ist bewusst eingeschränkt. Diese Grenzen sind Teil der Konstruktion und nicht optional.

- **Nur lokale Git-Repositories.** Ohne `.git` startet das Tool nicht. Arbeitet man mit fremden, ungespeicherten Änderungen, verweigert es die Korrektur.
- **Keine Angriffe.** Das Tool sendet keine Anfragen an laufende Systeme. Es analysiert Quellcode und Abhängigkeiten, mehr nicht.
- **Keine Ausführung von Exploits.** Die Tests dienen nur der Prüfung der Korrektur.
- **Eng begrenzte Änderungen.** Korrigiert werden nur Semgrep-Befunde mit Datei. Pro Befund wird eine einzelne Datei geändert.
- **Geschützte Pfade.** `.git`, `node_modules` und `.env*` werden nie angefasst.
- **Keine automatischen Commits.** Ohne `--commit` und ausdrückliches „ja“ bleibt alles im Branch.
- **Datenschutz.** Der Inhalt der betroffenen Datei wird an die Anthropic-API gesendet. Verarbeiten Sie keine Dateien mit Geheimnissen, Kundendaten oder vertraulichem Code, bevor Sie geprüft haben, ob das zulässig ist.
- **Keine Garantie.** Auch geprüfte Korrekturen müssen Sie lesen, bevor Sie sie übernehmen.

## Ausschlüsse und Fehlalarme

Testdaten und Beispielschlüssel lösen oft Fehlalarme aus. Legen Sie dafür im Wurzelverzeichnis des Projekts eine Datei `.sicherheitsfixer.json` an:

```json
{
  "ausschliessen": [
    { "muster": "test/**", "grund": "Testdaten ohne echte Zugangsdaten" },
    { "muster": "**/*.spec.ts", "grund": "Unit-Tests mit Dummy-Werten" }
  ]
}
```

Jeder Eintrag braucht ein `muster` (Glob) und einen `grund`. Ohne Begründung bricht das Tool ab. Ausgeschlossene Befunde werden im Bericht gezählt, damit Ausschlüsse nachvollziehbar bleiben.

Der Scanner `eslint` prüft TypeScript- und JavaScript-Dateien auf typische Schwachstellen, etwa unsichere Dateipfade, dynamische Ausführung und unsichere DOM-Zuweisungen. Er ergänzt Semgrep und ersetzt es nicht.


## Erweiterte Nutzung

### Architektur

```mermaid
flowchart LR
  classDef repo fill:#1a1a1a,stroke:#D4AF37,color:#F6D365
  classDef scan fill:#0b3d2e,stroke:#2ecc71,color:#d8ffe9
  classDef ai fill:#2b1d4a,stroke:#b58cff,color:#f1e9ff
  classDef gate fill:#3d2b00,stroke:#D4AF37,color:#fff3c4
  classDef done fill:#0b2a3d,stroke:#4fc3f7,color:#e1f5ff
  R["📁 Repository"]:::repo --> S["🔍 Scan<br/>Semgrep · ESLint · npm audit · Gitleaks"]:::scan
  S --> T["🧹 Triage<br/>Zusammenführen · Filtern"]:::scan
  T --> A["🤖 Fixer"]:::ai
  A --> REV["🧐 Reviewer"]:::ai
  REV --> V{"✅ Verifier<br/>Befund weg · Typen · Tests"}:::gate
  V --> B["🌿 Branch"]:::done
  B --> C["📝 Commit nur nach Freigabe"]:::gate
```

### Exit-Code für CI

```bash
node dist/cli.js scan . --fehler-ab high
```
Der Befehl endet mit Code `1`, wenn ein Befund mit Schwere „high“ oder höher vorliegt. So bricht eine Pipeline bei ernsten Befunden ab.

### JSON-Ausgabe

```bash
node dist/cli.js scan . --json befunde.json
```

### Befunde im Code unterdrücken

Schreiben Sie eine Begründung direkt über die betroffene Zeile:

```ts
// sicherheitsfixer-ignore: sicherheit/sql-injection -- Eingabe wird vorher über eine Whitelist geprüft
db.query(`SELECT * FROM ${tabelle}`);
```

Ohne `-- Begründung` wirkt die Unterdrückung nicht. Mit `*` statt einer Regel unterdrückt sie alle Befunde der Zeile.


## Konfiguration

| Option / Variable | Standard | Wirkung |
|---|---|---|
| `ANTHROPIC_API_KEY` | – | API-Schlüssel, erforderlich für `fix` |
| `--min` | `low` | Mindestschwere: `critical`, `high`, `medium`, `low`, `info` |
| `--max` | `5` | Maximale Anzahl Korrekturen pro Lauf |
| `--modell` | `claude-sonnet-5-5` | Modell für Korrekturvorschläge |
| `--semgrep-config` | `p/typescript` | Semgrep-Regelsatz |
| `--bericht` | – | Bericht in Datei schreiben statt auf der Konsole ausgeben |
| `--commit` | aus | Nach Prüfung und Bestätigung committen |

Das Protokoll liegt unter `~/.sicherheitsfixer/audit.jsonl` und damit außerhalb jedes Repositories.

## Testlauf mit OWASP Juice Shop

Juice Shop enthält absichtlich Schwachstellen und ist ein geeignetes Testziel. Eine Anleitung finden Sie in [`docs/juice-shop.md`](docs/juice-shop.md).

```bash
git clone https://github.com/juice-shop/juice-shop.git
node dist/cli.js scan ./juice-shop --bericht bericht.md
```

## Entwicklung

```bash
npm run dev -- scan ./beispiel    # direkt aus dem Quellcode starten
npm run build                     # nach dist/ kompilieren
npm test                          # Tests ausführen
```

Projektstruktur:

```
src/
├── cli.ts          Einstiegspunkt und Ablauf
├── scanners.ts     Aufruf von Semgrep, npm audit, Gitleaks
├── sarif.ts        Einlesen von SARIF-Berichten
├── triage.ts       Duplikate, Filter, Sortierung
├── fixer.ts        Korrekturvorschlag über die Anthropic-API
├── verify.ts       Prüfung nach jeder Korrektur
├── guard.ts        Sicherheitsprüfungen für Pfade und Repositories
├── git.ts          Branch und Commit
├── report.ts       Bericht auf Deutsch
└── audit.ts        Protokoll
```

## Roadmap

- [ ] Zeilenunabhängige Befund-Erkennung, damit Verschiebungen nach einer Korrektur sauber verfolgt werden
- [ ] Unterstützung für Python-Projekte
- [ ] HTML-Bericht mit Filtern
- [x] Testlauf ohne Änderungen (`--trocken`)
- [ ] Eigene Regeln als Datei einbinden

## Mitwirken

Beiträge sind willkommen. Bitte öffnen Sie zuerst ein Issue, wenn Sie etwas Größeres ändern möchten. Sicherheitslücken in diesem Tool melden Sie bitte privat über die GitHub-Funktion „Security Advisory“, nicht als öffentliches Issue.

## Lizenz

[MIT](LICENSE)

## Changelog

### 0.6.0
- Exit-Code bei Schwelle mit `--fehler-ab <stufe>`: Ein CI-Lauf schlägt fehl, wenn Befunde ab dieser Schwere vorliegen.
- JSON-Ausgabe mit `--json <datei>`.
- Befunde lassen sich mit `// sicherheitsfixer-ignore: <regel> -- <begründung>` unterdrücken. Die Begründung ist Pflicht.
- Farbiges Architekturdiagramm in der README.

### 0.5.0
- Neuer Ausgabeformat SARIF 2.1.0 (`--sarif <datei>`). Befunde erscheinen im Tab „Security“ des Repositories über GitHub Code Scanning.
- Neuer CI-Workflow `sicherheitsscan.yml`: führt Semgrep und ESLint aus, lädt den Bericht als Artefakt hoch und meldet die Ergebnisse an GitHub.
- Neues goldenes Design für die README mit Banner und Abzeichen.

### 0.4.2
- Mehrfachmeldungen derselben Stelle aus verschiedenen ESLint-Regeln erscheinen als ein Befund, mit allen Regeln aufgelistet.
- Der Bericht enthält eine Übersicht der Befunde nach Quelle.
- Die Anleitung für Juice Shop zeigt, wie Übungsdateien und Testdaten ausgeschlossen werden.

### 0.4.1
- Neue Regeln für SQL-Injection (`sicherheit/sql-injection`) und XSS (`sicherheit/xss-dom`, `sicherheit/xss-reflected`).
- Konfigurationsfehler von ESLint erscheinen nicht mehr als Sicherheitsbefunde.
- Minifizierte Dateien und Dritt-Bibliotheken (`vendor`, `assets/private`) werden standardmäßig nicht geprüft.

### 0.4.0
- Neuer Haupt-Scanner: ESLint mit Sicherheitsregeln. Er läuft vollständig in Node.js und braucht keinen Build auf dem Gerät.
- Semgrep ist optional. Fehlt es, steht ein Hinweis im Bericht.
- Automatische Korrekturen beschränken sich weiterhin auf Semgrep-Befunde.
- Laute Regeln mit vielen Fehlalarmen sind deaktiviert.
- Ausschlüsse über `.sicherheitsfixer.json`. Jeder Eintrag braucht ein Muster und eine Begründung.
- Ausgeschlossene Befunde werden im Bericht gezählt, damit Ausschlüsse sichtbar bleiben.

### 0.3.0
- Agenten-Modus mit `--agenten`: unabhängiger Reviewer prüft jede Korrektur.
- Fail-closed: Fehler oder unklare Antworten gelten als Ablehnung.

### 0.2.0
- Mehrere Vorkommen derselben Regel in einer Datei können jetzt nacheinander korrigiert werden.
- Neuer Trockenlauf mit `--trocken`.
- GitHub-Actions-Workflow für Build und Tests.
- Klon-Link in der Dokumentation korrigiert.
