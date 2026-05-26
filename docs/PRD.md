# mcpwatchtower PRD

Status: in-progress

## Summary

mcpwatchtower is a local-first CLI that audits MCP server configs before an
agent uses them. It finds risky command launches, broad environment exposure,
duplicate tool names, suspicious package specs, and config drift, then emits
plain text and JSON reports that developers can wire into preflight checks.

## Why now

MCP adoption is accelerating across developer tooling, while recent reporting
has highlighted prompt-injection and command-execution risks in MCP servers and
agent integrations. Developers need a boring, deterministic preflight checker
they can run before granting an agent new tools.

## Source attribution

Inspired by current MCP adoption and security coverage, including reporting on
MCP support expanding across products and public discussion of MCP command
execution and marketplace risks. This project is renamed, reframed, and built
as an original local audit utility.

## Target users

- Developers configuring MCP servers for local coding agents.
- Agent platform maintainers reviewing shared tool catalogs.
- Security-minded teams that want a lightweight config gate without a SaaS.

## MVP

- Read MCP config JSON from a file or stdin.
- Support common shapes: top-level `mcpServers`, raw server maps, and arrays.
- Detect risky command patterns such as `sh -c`, `curl | sh`, `npx` without
  pinned packages, writable mount hints, broad env pass-through, and duplicate
  server or tool names where discoverable.
- Emit `text` and `json` output.
- Exit non-zero when findings at or above a configurable severity exist.
- Include fixture-backed tests and a real CLI smoke.

## Non-goals

- Runtime sandboxing.
- Network calls or package reputation lookups.
- Acting as an MCP client.

## CLI sketch

```bash
mcpwatchtower scan .mcp.json
mcpwatchtower scan --format json --fail-on medium fixtures/risky.json
cat config.json | mcpwatchtower scan -
```

## Success criteria

- A developer can install, run against sample configs, and get useful findings
  in under one minute.
- All checks are deterministic and local.
- Reports explain remediation clearly enough to fix the config.
