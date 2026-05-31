# mcpwatchtower Orchestration

This project is a local CLI. It performs no network calls during scans and does
not execute configured MCP server commands.

## Pipeline

1. Read JSON config from a file or stdin.
2. Normalize supported MCP config shapes into server records.
3. Run deterministic rule modules over normalized records.
4. Render a text or JSON report.
5. Exit non-zero when a finding meets `--fail-on`.

## Local Commands

```sh
npm run check
npm test
npm run smoke
npm run package:smoke
bash scripts/validate.sh
```

## Release Readiness

Before publishing, verify release workflows with `npm run release:check`, run a
real CLI smoke, confirm branch protection, and review [RELEASE_NOTES.md](../RELEASE_NOTES.md).

## Safety Boundaries

- Scans are local and deterministic.
- The CLI reads config JSON only; it does not execute configured MCP commands.
- The CLI performs no package, reputation, vulnerability, or network lookups.
- Non-zero exits are controlled by `--fail-on` and are intended for preflight gates.
