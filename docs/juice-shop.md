# Testlauf mit OWASP Juice Shop

OWASP Juice Shop ist eine absichtlich verwundbare Anwendung für Schulungszwecke. Sie eignet sich als Testziel, weil ihre Schwachstellen bekannt und dokumentiert sind.

## Vorbereitung

```bash
git clone https://github.com/juice-shop/juice-shop.git
cd juice-shop
npm install
```

## Ausschlüsse festlegen

Juice Shop enthält Übungsdateien und Testdaten. Diese Dateien sollen nicht den Bericht überlagern. Legen Sie im Projektordner eine Datei `.sicherheitsfixer.json` an:

```json
{
  "ausschliessen": [
    { "muster": "data/static/codefixes/**", "grund": "Übungsdateien mit absichtlichen Fehlern" },
    { "muster": "test/**", "grund": "Testdaten ohne echte Zugangsdaten" },
    { "muster": "frontend/**/*.spec.ts", "grund": "Unit-Tests mit Dummy-Werten" }
  ]
}
```

Die Datei gehört nicht ins Repository von Juice Shop. Sie dient nur dem lokalen Testlauf.

## Scan

```bash
node /pfad/zu/sicherheitsfixer/dist/cli.js scan ./juice-shop --bericht bericht.md
```

Im Bericht zeigt der Abschnitt „Nach Quelle“, wie viele Befunde von welchem Scanner stammen. Die Hinweise am Ende nennen, wie viele Befunde durch die Ausschlussdatei entfallen sind.

## Korrekturen vorschlagen

Arbeiten Sie nur in Ihrer lokalen Kopie. Der Befehl legt einen Branch an und committet nichts ohne Ihre Bestätigung.

```bash
export ANTHROPIC_API_KEY=ihr-schluessel
node /pfad/zu/sicherheitsfixer/dist/cli.js fix ./juice-shop --max 3
```
