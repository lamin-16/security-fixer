# Benchmark

Die Datei `juice-shop.json` enthält nur zwei Einträge. Sie ist ein Anfang und keine vollständige Liste.

So vervollständigen Sie sie:
1. Öffnen Sie in der laufenden Juice Shop-Anwendung das Score Board.
2. Übertragen Sie jede Übung mit Code-Ort in die Datei. Übungen, die nur zur Laufzeit funktionieren, lassen sich statisch nicht finden. Kennzeichnen Sie sie mit `"laufzeit": true`, damit sie gesondert gezählt werden können.
3. Prüfen Sie jeden Eintrag im Quellcode, bevor Sie ihn speichern.

Messen:
```bash
node dist/cli.js benchmark ~/juice-shop --wahrheit docs/benchmark/juice-shop.json
```
