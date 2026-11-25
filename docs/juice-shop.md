# Testlauf mit OWASP Juice Shop

OWASP Juice Shop ist eine absichtlich verwundbare Anwendung für Schulungszwecke. Sie eignet sich als Testziel, weil ihre Schwachstellen bekannt und dokumentiert sind.

## Vorbereitung

```bash
git clone https://github.com/juice-shop/juice-shop.git
cd juice-shop
npm install
```

## Scan

```bash
node /pfad/zu/sicherheitsfixer/dist/cli.js scan ./juice-shop --bericht bericht.md
```

## Korrekturen vorschlagen

Arbeiten Sie nur in Ihrer lokalen Kopie. Der Befehl legt einen Branch an und committet nichts ohne Ihre Bestätigung.

```bash
export ANTHROPIC_API_KEY=ihr-schluessel
node /pfad/zu/sicherheitsfixer/dist/cli.js fix ./juice-shop --max 3
```
