# Changelog

All notable changes to this project will be documented in this file.

This project follows the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
format and uses semantic versioning when versioned releases are published.

## [Unreleased]

### Fixed

- Report Git package URLs that use mutable tag or branch references as unpinned.

### Added

- Local-first `mcpwatchtower scan` CLI for MCP config preflight checks.
- Static checks for shell evaluation, pipe-to-shell downloads, unpinned package launches, risky environment exposure, writable mount hints, and duplicate names.
- Text and JSON output with configurable `--fail-on` thresholds.
- Fixture-backed tests, example configs, and release readiness docs.

## Release Links

- Unreleased:
  `https://github.com/rogerchappel/mcpwatchtower/compare/v0.1.0...HEAD`
- Latest release:
  `https://github.com/rogerchappel/mcpwatchtower/releases/latest`
