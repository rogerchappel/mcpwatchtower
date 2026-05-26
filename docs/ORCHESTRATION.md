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

Before publishing, create the GitHub repository, push `main`, configure branch
protection, and verify release workflows with `npm run release:check`.
