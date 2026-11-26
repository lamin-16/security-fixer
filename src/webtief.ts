import { fingerprint } from "./sarif.js";
import { findeSkriptUrls, istExponierterPfad, pruefeCookie, pruefeHeader, pruefeJs } from "./passiv.js";
import type { Finding, Severity } from "./types.js";

/**
 * Tiefe passive Prüfung: folgt internen Links, prüft, was der Browser lädt.
 * Grenzen wie bei der einfachen Prüfung: nur GET, nur dieselbe Herkunft,
 * begrenzte Anzahl Anfragen mit Pause, keine Dateiinhalte gespeichert.
 * Aktive Tests wie Eingabe-Injektion sind bewusst nicht enthalten.
 */
export const MAX_ANFRAGEN_TIEF = 40;
export const MAX_SEITEN = 8;
const MAX_SKRIPTE_GESAMT = 12;
const PAUSE_MS = 500;
const TIMEOUT_MS = 10_000;
const PFADE = ["/.env", "/.git/HEAD", "/.git/config"];

function befund(rule: string, severity: Severity, message: string, file: string): Finding {
  return { id: "", source: "web", rule, severity, message, file, fingerprint: fingerprint("web", rule, file) };
}

/** Interne Links einer Seite. Fragmente werden entfernt, nur dieselbe Herkunft wird übernommen. */
export function findeInternLinks(html: string, base: string): string[] {
  const herkunft = new URL(base).origin;
  const urls = new Set<string>();
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(m[1], base);
      if (u.origin === herkunft && (u.protocol === "https:" || u.protocol === "http:")) {
        u.hash = "";
        urls.add(u.href);
      }
    } catch {
      // ungültige Adresse: überspringen
    }
  }
  return [...urls];
}

/** Unverschlüsselte Ressourcen auf einer https-Seite. */
export function pruefeGemischt(html: string, pageUrl: string): Finding[] {
  if (!pageUrl.startsWith("https://")) return [];
  const anzahl = [...html.matchAll(/(?:src|href|action)=["'](http:\/\/[^"']+)["']/gi)].length;
  return anzahl > 0
    ? [befund("web/gemischte-inhalte", "medium", `${anzahl} unverschlüsselte Ressourcen (http://) auf einer https-Seite`, pageUrl)]
    : [];
}

/** Externe Skripte ohne Subresource Integrity. */
export function pruefeSri(html: string, pageUrl: string): Finding[] {
  const herkunft = new URL(pageUrl).origin;
  const fehlend = [...html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi)].filter((m) => {
    let u: URL;
    try {
      u = new URL(m[1], pageUrl);
    } catch {
      return false;
    }
    return u.origin !== herkunft && !/integrity=/i.test(m[0]);
  });
  return fehlend.length > 0
    ? [befund("web/sri-fehlt", "low", `${fehlend.length} externe Skripte ohne Integritätsprüfung (SRI)`, pageUrl)]
    : [];
}

/** Anmeldeformulare, die Zugangsdaten über http senden oder selbst über http liegen. */
export function pruefeFormulare(html: string, pageUrl: string): Finding[] {
  const out: Finding[] = [];
  for (const m of html.matchAll(/<form[^>]*>([\s\S]*?)<\/form>/gi)) {
    if (!/type=["']password["']/i.test(m[1])) continue;
    const action = m[0].match(/action=["']([^"']+)["']/i)?.[1] ?? pageUrl;
    let ziel: URL;
    try {
      ziel = new URL(action, pageUrl);
    } catch {
      continue;
    }
    if (ziel.protocol === "http:" || pageUrl.startsWith("http://")) {
      out.push(befund("web/login-unverschluesselt", "high", "Anmeldeformular überträgt Zugangsdaten unverschlüsselt", pageUrl));
    }
  }
  return out;
}

/** robots.txt: gesperrte Pfade sind öffentlich einsehbar. Nur die Anzahl wird gemeldet. */
export function pruefeRobots(text: string, base: string): Finding[] {
  const eintraege = text
    .split(/\r?\n/)
    .filter((z) => /^\s*disallow:/i.test(z) && (z.split(":")[1] ?? "").trim() !== "");
  return eintraege.length > 0
    ? [befund("web/robots-disallow", "low", `robots.txt nennt ${eintraege.length} gesperrte Pfade. Diese Liste ist öffentlich einsehbar.`, `${base}robots.txt`)]
    : [];
}

export interface TiefErgebnis {
  findings: Finding[];
  anfragen: number;
  seiten: number;
  warnings: string[];
}

export async function scanWebTief(url: string): Promise<TiefErgebnis> {
  const base = new URL(url);
  const lokal = base.hostname === "localhost" || base.hostname === "127.0.0.1";
  if (base.protocol !== "https:" && !lokal) {
    throw new Error("Nur https-Adressen oder localhost sind erlaubt.");
  }

  const findings: Finding[] = [];
  const warnings: string[] = [];
  let anfragen = 0;

  const holen = async (u: URL): Promise<Response | null> => {
    if (anfragen >= MAX_ANFRAGEN_TIEF) throw new Error("Anfragelimit erreicht");
    if (u.origin !== base.origin) throw new Error("Fremde Herkunft verweigert");
    anfragen++;
    await new Promise((r) => setTimeout(r, PAUSE_MS));
    const res = await fetch(u, {
      method: "GET",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "Sicherheitsfixer/0.9.0 (passive Prüfung)" },
    });
    if (new URL(res.url).origin !== base.origin) {
      await res.body?.cancel();
      warnings.push(`Weiterleitung zu fremder Herkunft ignoriert: ${u.pathname}`);
      return null;
    }
    return res;
  };

  // Startseite: Header und Cookies
  const start = await holen(base);
  if (!start) return { findings, anfragen, seiten: 0, warnings };

  const headers: Record<string, string> = {};
  start.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
  findings.push(...pruefeHeader(headers, base.href));
  for (const c of ((start.headers as any).getSetCookie?.() ?? []) as string[]) {
    findings.push(...pruefeCookie(c, base.href));
  }
  const startHtml = (await start.text()).slice(0, 2_000_000);

  // Interne Seiten, begrenzt
  const seiten = new Map<string, string>([[base.href, startHtml]]);
  for (const link of findeInternLinks(startHtml, base.href)) {
    if (seiten.size >= MAX_SEITEN) break;
    if (seiten.has(link)) continue;
    const res = await holen(new URL(link));
    if (!res) continue;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html")) {
      await res.body?.cancel();
      continue;
    }
    seiten.set(link, (await res.text()).slice(0, 2_000_000));
  }

  // Seitenbezogene Prüfungen
  for (const [seite, html] of seiten) {
    findings.push(...pruefeGemischt(html, seite), ...pruefeSri(html, seite), ...pruefeFormulare(html, seite));
  }

  // Skripte aller Seiten, ohne Doppelte, begrenzt
  const skripte = new Set<string>();
  for (const html of seiten.values()) {
    for (const u of findeSkriptUrls(html, base.href)) skripte.add(u);
  }
  for (const skript of [...skripte].slice(0, MAX_SKRIPTE_GESAMT)) {
    const res = await holen(new URL(skript));
    if (!res) continue;
    findings.push(...pruefeJs((await res.text()).slice(0, 2_000_000), skript));
  }

  // Bekannte Pfade: nur Status und Inhaltstyp
  for (const pfad of PFADE) {
    const res = await holen(new URL(pfad, base.origin));
    if (!res) continue;
    const ct = res.headers.get("content-type") ?? "";
    if (istExponierterPfad(res.status, ct)) {
      findings.push(befund("web/exponierter-pfad", "high", `Datei ${pfad} ist öffentlich abrufbar`, pfad));
    }
    await res.body?.cancel();
  }

  // robots.txt
  const robots = await holen(new URL("/robots.txt", base.origin));
  if (robots) {
    const ct = robots.headers.get("content-type") ?? "";
    if (robots.status === 200 && ct.includes("text/plain")) {
      findings.push(...pruefeRobots(await robots.text(), base.origin + "/"));
    } else {
      await robots.body?.cancel();
    }
  }

  return { findings, anfragen, seiten: seiten.size, warnings };
}
