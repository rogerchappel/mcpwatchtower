# mcpwatchtower 0.1.0 Release Candidate

## Classification

Release candidate: ship-ready MVP after local verification and maintainer review.

## Summary

- Local-first `mcpwatchtower scan` CLI for MCP config preflight checks.
- Supports file and stdin input, text and JSON output, and configurable failure thresholds.
- Detects shell evaluation, pipe-to-shell downloads, unpinned package launches, broad environment pass-through, sensitive-looking environment names, writable mount hints, and duplicate server/tool names where discoverable.
- Includes fixture-backed tests, example configs, and release-readiness documentation.

## Verification

Run before release:

```sh
npm run check
npm test
npm run smoke
npm run package:smoke
npm run release:check
bash scripts/validate.sh
```

Manual smoke:

```sh
node dist/src/cli.js scan tests/fixtures/risky.json --format json --fail-on medium
cat tests/fixtures/clean.json | node dist/src/cli.js scan - --format text --fail-on high
```

## Limitations

- Static local analysis only; it does not execute, sandbox, or contact MCP servers.
- No package reputation, vulnerability, or network lookup.
- Tool-name duplicate detection only works when tools are listed in config.
- Rule suppressions, SARIF output, and richer client-specific fixtures are future work.
