# Security policy

## Reporting a vulnerability in Sicherheitsfixer

Please **do not** open a public issue for a security problem in this tool.

Use GitHub's private vulnerability reporting: open the repository's **Security** tab and choose **Report a vulnerability**. Include:

- the version (`node dist/cli.js --hilfe` prints it),
- the command you ran,
- a minimal reproduction, and
- the impact you expect.

## What is in scope

- Ways the tool could modify files, run commands, or send data outside what its documentation describes.
- Bypasses of the path guard, the confirmation flag for web checks, or the request limits.
- Secrets written to reports, SARIF output, or the audit log.

## What is out of scope

- Findings the tool reports about **other** projects. Report those to the project owner.
- Missed detections. Those are welcome as regular issues, ideally with a small failing example.

## Response

This is maintained by one person as an open project. I will acknowledge reports as soon as I can and fix confirmed issues in the next release. I cannot offer a bug bounty.
