export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type FindingSource = "semgrep" | "eslint" | "npm-audit" | "gitleaks" | "web";

export interface Finding {
  /** Laufende ID nach dem Sortieren, z. B. F-001 */
  id: string;
  source: FindingSource;
  /** Regel- oder Paketname */
  rule: string;
  severity: Severity;
  message: string;
  file?: string;
  line?: number;
  /** Stabiler Schlüssel zum Wiedererkennen eines Befunds */
  fingerprint: string;
}

export interface FixProposal {
  file: string;
  newContent: string;
  explanation: string;
}
