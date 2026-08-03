# mcpwatchtower

Local-first preflight checks for MCP server configs.

## Status

This repository is early-stage. The CLI is usable for deterministic local
config checks, but the rule set is intentionally conservative and should be
treated as a review aid rather than a complete security scanner.

## Install

```sh
npm install mcpwatchtower
```

For local development:

```sh
npm install
npm run build
```

## Use

```sh
npx mcpwatchtower scan .mcp.json
mcpwatchtower scan examples/risky.mcp.json --format json --fail-on medium
cat config.json | mcpwatchtower scan -
```

The scanner accepts common MCP config shapes:

- top-level `mcpServers`
- raw server maps
- arrays of server objects

These shapes must be non-empty, every server entry must be an object, and
`mcpServers` itself must be an object map. Invalid shapes produce a
`config.invalid-shape` finding at `high` severity instead of a successful
zero-finding audit. Consequently, they exit non-zero with the default
`--fail-on high` threshold; JSON and text output both include the finding and
its remediation.

Each server entry requires a non-empty string `command`. Optional `args` must
be an array of strings, `env` must be an object map, and `tools` must be an
array containing tool-name strings or objects such as `{ "name": "read_file" }`.
Field findings identify the exact invalid path, while valid sibling servers
continue through the audit rules.

It currently flags:

- shell evaluation such as `bash -c`
- network downloads piped to a shell
- unpinned package-manager launches such as `npx package` (including package
  selectors such as `npm exec --package=package` and `uvx --from package`)
- broad or sensitive-looking environment pass-through
- Docker volume and bind mounts that are writable by default or explicitly
  writable; `:ro`, `:readonly`, and `readonly=true` mounts are allowed
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
the private reporting path with project-specific contact details before a
public release.

## Examples

Example configs live in [examples](examples). They are intentionally small so
the scanner output is easy to inspect.

## Safety Notes

This package is intended for local, reviewable developer and agent workflows. Review generated reports, plans, or artifacts before sharing them publicly or using them to drive external actions. Do not place secrets, private logs, customer data, or credentials in fixtures, issues, or examples.

## License

MIT

## Verification

Run these checks before opening a PR or publishing a release:

```bash
npm test
npm run smoke
npm run package:smoke
npm run release:check
```
