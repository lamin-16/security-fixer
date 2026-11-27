# Sicherheitsfixer

**A static security scanner for TypeScript projects that proposes fixes which are reviewed and verified before anyone sees them. Nothing is committed without your approval.**

> German documentation: [README.md](README.md)

## What it is

- A **static** analyzer. It reads source code, lockfiles, and published web responses. It does not exploit anything.
- A **fix pipeline**: a model proposes a minimal change, an independent reviewer model tries to reject it, a deterministic verifier re-runs the finding check, TypeScript, and the tests. Changes land on a separate Git branch.
- A **passive web checker** for sites you own: security headers, cookies, exposed files, mixed content, forms over plain HTTP, subresource integrity.

## What it is not

- It is **not** a dynamic scanner. It does not send injection payloads, fuzz inputs, or test authorization logic. For active testing, use established tools such as OWASP ZAP against systems you are authorized to test.
- It is **not** a replacement for Semgrep, CodeQL, or a human review. It covers a narrow set of patterns and says so in its output.
- It does **not** fix findings automatically unless you pass `fix`, and it never pushes.

## Quick start

```bash
npm install && npm run build

# Scan a local Git repository (only files Git tracks, by default)
node dist/cli.js scan ./my-project --bericht report.md

# Fail a CI job at high severity
node dist/cli.js scan . --fehler-ab high

# Passive check of a site you own (requires an explicit confirmation flag)
node dist/cli.js web https://example.com --ich-besitze-es --tief
```

Output formats: Markdown (`--bericht`), SARIF 2.1.0 (`--sarif`, uploads to GitHub Code Scanning), JSON (`--json`).

## Design principles

- **Read-only by default.** `scan` and `web` do not modify files.
- **Bounded network access.** The web checker only issues `GET` requests to the same origin, caps the total number of requests, pauses between them, and never stores response bodies.
- **Fail closed.** An unclear reviewer answer counts as a rejection. A broken configuration file aborts the run instead of being ignored.
- **Traceable decisions.** Every scan, review, verification, and commit is written to a local audit log outside the repository.
- **Suppressions need a reason.** `// sicherheitsfixer-ignore: <rule> -- <reason>` without a reason has no effect.

## Rules

Custom rules (details and examples in [docs/regeln.md](docs/regeln.md)):

| Rule | Detects |
|---|---|
| `sicherheit/sql-injection` | SQL built with template literals or string concatenation |
| `sicherheit/xss-dom` | `innerHTML`, `outerHTML`, `document.write`, `insertAdjacentHTML` with non-literal values |
| `sicherheit/xss-reflected` | Request data written into a server response without encoding |
| `sicherheit/gesicherter-import` | Suppresses dynamic-import warnings **only** when the value is checked against a fixed list and that same value is used |

Imported engines: ESLint security rules (`eslint-plugin-security`, `eslint-plugin-no-unsanitized`), Gitleaks, `npm audit`, Semgrep (optional, if installed).

## Known limitations

These are real and worth reading before you rely on the output:

- **Pattern-based.** Data flow across functions and modules is not tracked. A value passed through several helpers can be missed.
- **Guard detection is narrow.** Only `hasLocale(...)` and `.includes(...)` inside a `const` conditional count as validation. Other validation styles are reported, which can produce false positives.
- **Minified and generated code** is excluded by default (`.next`, `releases`, `out`, `.turbo`, `*.min.js`, `vendor`, `assets/private`). Vulnerabilities in those paths will not be reported.
- **Semgrep requires a local installation.** Without it, injection rules come only from the custom ESLint rules.
- **The web checker sees only what a browser receives** on the pages it can reach. It cannot see authorization problems or behaviour that only appears after input.

## Measured results

Measurements are published alongside their limits. The benchmark command reports recall and precision against a labelled list:

```bash
node dist/cli.js benchmark ./juice-shop --wahrheit docs/benchmark/juice-shop.json
```

The shipped ground-truth file currently contains **two entries**. That is too few for a meaningful recall or precision figure, and this project does not claim one. Extending it with a complete, verified list of OWASP Juice Shop code-level challenges is the most useful contribution a researcher could make here.

## Comparison

| | Sicherheitsfixer | Semgrep | CodeQL | ARTEX |
|---|---|---|---|---|
| Static analysis | yes, narrow rule set | yes, large rule set | yes, deep data flow | no |
| Dynamic / exploitation | no | no | no | yes |
| Verified automatic fixes | yes, reviewed and verified | partial | no | n/a |
| Runs offline on a phone (Termux) | yes | no | no | no |
| Maturity | early prototype | mature | mature | mature |

Use the tools that fit your situation. Sicherheitsfixer is useful when you want a small, auditable scanner with a conservative fix workflow.

## Roadmap

- Extend the Juice Shop ground truth with verified, code-level challenges and publish the methodology.
- Track data flow through simple local helper functions.
- Passive header and TLS checks with a fixed, documented request budget.

## Security

Please report vulnerabilities in this tool privately. See [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).
