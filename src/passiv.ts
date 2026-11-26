import { fingerprint } from "./sarif.js";
import type { Finding, Severity } from "./types.js";

/**
 * Passive Prüfung einer veröffentlichten Website.
 * Grenzen, die im Code festgelegt sind:
 * - nur GET-Anfragen
 * - nur dieselbe Herkunft wie das Ziel
 * - höchstens MAX_ANFRAGEN Anfragen, mit Pause dazwischen
 * - Inhalte von Dateien werden nicht gespeichert, nur Befunde
 */
export const MAX_ANFRAGEN = 20;
export const PAUSE_MS = 500;
const TIMEOUT_MS = 10_000;
const MAX_SKRIPTE = 10;
const PFADE = ["/.env", "/.git/HEAD", "/.git/config"];

function befund(rule: string, severity: Severity, message: string, file: string): Finding {
  return { id: "", source: "web", rule, severity, message, file, fingerprint: fingerprint("web", rule, file) };
}

const HEADER_PRUEFUNG: [string, Severity, string][] = [
  ["content-security-policy", "medium", "Keine Content-Security-Policy gesetzt"],
  ["strict-transport-security", "medium", "Kein HSTS gesetzt"],
  ["x-content-type-options", "low", "X-Content-Type-Options fehlt"],
  ["referrer-policy", "low", "Referrer-Policy fehlt"],
];

/** Prüft die Sicherheitsheader der Startseite. Header-Namen in Kleinbuchstaben. */
export function pruefeHeader(headers: Record<string, string>, base: string): Finding[] {
  const out: Finding[] = [];
  for (const [name, severity, text] of HEADER_PRUEFUNG) {
    if (!headers[name]) out.push(befund(`web/${name}`, severity, text, base));
  }
  const csp = headers["content-security-policy"] ?? "";
  if (!headers["x-frame-options"] && !csp.includes("frame-ancestors")) {
    out.push(befund("web/clickjacking-schutz", "low", "Kein Schutz gegen Einbettung in fremde Seiten", base));
  }
  return out;
}

/** Prüft ein Set-Cookie-Attribut auf Secure, HttpOnly und SameSite. */
export function pruefeCookie(setCookie: string, base: string): Finding[] {
  const teile = setCookie.split(";");
  const name = teile[0].split("=")[0].trim();
  const attribute = teile.slice(1).map((s) => s.trim().toLowerCase().split("=")[0]);
  const out: Finding[] = [];
  if (!attribute.includes("secure")) out.push(befund("web/cookie-secure", "medium", `Cookie ${name} ohne Secure-Flag`, base));
  if (!attribute.includes("httponly")) out.push(befund("web/cookie-httponly", "medium", `Cookie ${name} ohne HttpOnly-Flag`, base));
  if (!attribute.includes("samesite")) out.push(befund("web/cookie-samesite", "low", `Cookie ${name} ohne SameSite-Attribut`, base));
  return out;
}

/** Sammelt Skript-Adressen derselben Herkunft aus dem HTML. */
export function findeSkriptUrls(html: string, base: string): string[] {
  const herkunft = new URL(base).origin;
  const urls = new Set<string>();
  for (const m of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
    try {
      const u = new URL(m[1], base);
      if (u.origin === herkunft) urls.add(u.href);
    } catch {
      // ungültige Adresse: überspringen
    }
  }
  return [...urls].slice(0, MAX_SKRIPTE);
}

/**
 * Prüft ein veröffentlichtes Skript auf Verweise auf Source Maps und auf
 * Muster, die wie fest eingebettete Schlüssel aussehen.
 * Der gefundene Wert wird nicht in den Bericht geschrieben.
 */
export function pruefeJs(js: string, url: string): Finding[] {
  const out: Finding[] = [];
  if (/\/\/[#@]\s*sourceMappingURL=/.test(js)) {
    out.push(befund("web/sourcemap-verweis", "low", "Skript verweist auf eine Source Map", url));
  }
  const muster = [
    /AKIA[0-9A-Z]{16}/,
    /(api[_-]?key|secret|token)["']?\s*[:=]\s*["'][A-Za-z0-9_\-]{20,}["']/i,
  ];
  if (muster.some((m) => m.test(js))) {
    out.push(befund("web/geheimnis", "high", "Mögliches fest eingebettetes Geheimnis im Skript", url));
  }
  return out;
}

/** Eine Datei gilt als exponiert, wenn sie abrufbar ist und kein HTML der Anwendung ist. */
export function istExponierterPfad(status: number, contentType: string): boolean {
  return status === 200 && !contentType.toLowerCase().includes("text/html");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface WebErgebnis {
  findings: Finding[];
  anfragen: number;
  warnings: string[];
}

/** Führt die passive Prüfung aus. Nur https oder localhost sind erlaubt. */
export async function scanWeb(url: string): Promise<WebErgebnis> {
  const base = new URL(url);
  const lokal = base.hostname === "localhost" || base.hostname === "127.0.0.1";
  if (base.protocol !== "https:" && !lokal) {
    throw new Error("Nur https-Adressen oder localhost sind erlaubt.");
  }

  const findings: Finding[] = [];
  const warnings: string[] = [];
  let anfragen = 0;

  const holen = async (u: URL): Promise<Response | null> => {
    if (anfragen >= MAX_ANFRAGEN) throw new Error("Anfragelimit erreicht");
    if (u.origin !== base.origin) throw new Error("Fremde Herkunft verweigert");
    anfragen++;
    await sleep(PAUSE_MS);
    const res = await fetch(u, {
      method: "GET",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "Sicherheitsfixer/0.8.0 (passive Prüfung)" },
    });
    if (new URL(res.url).origin !== base.origin) {
      await res.body?.cancel();
      warnings.push(`Weiterleitung zu fremder Herkunft ignoriert: ${u.pathname}`);
      return null;
    }
    return res;
  };

  // Startseite
  const start = await holen(base);
  if (!start) return { findings, anfragen, warnings };

  const headers: Record<string, string> = {};
  start.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
  findings.push(...pruefeHeader(headers, base.href));

  const setCookies = (start.headers as any).getSetCookie?.() ?? [];
  for (const c of setCookies as string[]) findings.push(...pruefeCookie(c, base.href));

  const html = (await start.text()).slice(0, 2_000_000);

  // Skripte derselben Herkunft
  for (const skript of findeSkriptUrls(html, base.href)) {
    const res = await holen(new URL(skript));
    if (!res) continue;
    const js = (await res.text()).slice(0, 2_000_000);
    findings.push(...pruefeJs(js, skript));
  }

  // Bekannte Pfade: nur Status und Inhaltstyp, nie der Inhalt
  for (const pfad of PFADE) {
    const res = await holen(new URL(pfad, base.origin));
    if (!res) continue;
    const ct = res.headers.get("content-type") ?? "";
    if (istExponierterPfad(res.status, ct)) {
      findings.push(befund("web/exponierter-pfad", "high", `Datei ${pfad} ist öffentlich abrufbar`, pfad));
    }
    await res.body?.cancel();
  }

  return { findings, anfragen, warnings };
}
