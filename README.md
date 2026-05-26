# mcpwatchtower

Local-first preflight checks for MCP server configs.

## Status

This repository is early-stage. The CLI is usable for deterministic local
config checks, but the rule set is intentionally conservative and should be
treated as a review aid rather than a complete security scanner.

## Install

```sh
npm install
npm run build
```

## Use

```sh
npx mcpwatchtower scan .mcp.json
mcpwatchtower scan fixtures/risky.json --format json --fail-on medium
cat config.json | mcpwatchtower scan -
```

The scanner accepts common MCP config shapes:

- top-level `mcpServers`
- raw server maps
- arrays of server objects

It currently flags:

- shell evaluation such as `bash -c`
- network downloads piped to a shell
- unpinned package-manager launches such as `npx package`
- broad or sensitive-looking environment pass-through
- writable filesystem mount hints
- duplicate server or tool names where tools are listed in config

`--fail-on` controls the exit threshold and defaults to `high`.
`--format` supports `text` and `json`.

## Verify

Run the local validation script before opening a pull request:

```sh
bash scripts/validate.sh
```

`scripts/validate.sh` runs the repository's standard local checks when they are defined and will also run `agent-qc ready` when `agent-qc` is installed. Missing `agent-qc` is treated as a skip, not a failure.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution expectations. Changes
should be small, reviewable, and verified before review.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting guidance. Replace
the default security policy before publishing the generated repository.

These links assume this README has been copied to the generated repository root.

## License

MIT
