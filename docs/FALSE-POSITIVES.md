# Understanding findings and false positives

mcpwatchtower uses conservative, deterministic checks over the configured launch
command, arguments, environment map, and listed tools. Findings are review
signals, not proof that a server is exploitable. Check the exact `path` and
`evidence` in the report against the configuration before changing anything.
Do not suppress a finding by weakening the scanner or hiding the configuration.

## Shell evaluation: `command.shell-eval` (high)

A shell invocation with an inline-command flag is reported, for example:

```json
{"command":"bash","args":["-c","node server.js"]}
```

A wrapper that genuinely needs shell syntax may be an intentional finding.
Prefer a direct executable and fixed arguments when possible, such as
`{"command":"node","args":["server.js"]}`. The rule checks for recognized inline-command flags and does not establish
that other shell invocations or scripts are safe.

## Download piped to shell: `command.pipe-to-shell` (critical)

A launch string containing a `curl` or `wget` command piped to `sh`, `bash`, or
`zsh` is reported. A script may be reviewed and internally controlled, but a
mutable remote response remains a real integrity risk. Download it through a
separate reviewed, pinned process rather than relying on an exception to the
finding.

## Unpinned package: `package.unpinned` (medium)

Package-manager invocations are reported when the package spec cannot be
recognized as pinned. Exact semantic versions, supported immutable commit
hashes, and digest selectors are treated as pinned; tags and branches in Git
URLs are mutable and are reported. A registry package name with no exact
version (such as `npx example-package`) is intentionally reported. Pin to an
exact version/commit/digest and review updates deliberately. This check parses
common command forms, not every package-manager alias or configuration file.

## Environment exposure: `env.broad-pass-through` (high) and
`env.sensitive-name` (medium)

Wildcard/process-environment values and variable names containing terms such
as `TOKEN`, `SECRET`, `PASSWORD`, `KEY`, or `AUTH` are flagged. A variable may
be harmless or required by the server; verify its actual scope and contents
without copying secret values into reports or examples. Replace broad
inheritance with only the named variables the server needs, and use narrowly
scoped credentials where necessary. The name-based rule can miss secrets with
unusual names and does not inspect values for secrets.

## Writable container mount: `filesystem.writable-mount` (medium)

Docker and Podman `-v`, `--volume`, or `--mount` host mounts are reported unless
the recognized mount options specify read-only access (`ro`, `readonly`, or
`readonly=true`). A writable mount may be necessary, but limit it to the
smallest required host directory. Read-only examples include:

```json
{"command":"docker","args":["run","--mount","type=bind,src=./data,dst=/data,readonly"]}
```

The rule only recognizes these container runtimes and mount argument forms;
absence of a finding is not a general guarantee that host files are protected.

## Duplicate names: `server.duplicate-name` (medium) and
`tool.duplicate-name` (low)

Repeated server names or explicitly listed tool names can make routing and
review ambiguous. If two entries intentionally expose the same tool, document
the distinction operationally and consider giving them distinct names. Tool
names are checked only when present in the configuration's `tools` list.

## Invalid configuration: `config.invalid-shape` (high)

Empty, malformed, or unsupported server/config shapes are reported rather than
counted as a clean scan. Fix the config structure and rerun the scan; a
zero-finding result from an invalid config would be misleading.

## Triage checklist

1. Confirm the finding ID, config path, and evidence refer to the intended
   server.
2. Compare the reported behavior with the actual command and deployment
   context; the scanner does not resolve variables or execute commands.
3. Prefer a narrow, safer configuration change (direct executable, pinned
   dependency, least-privilege environment, or read-only mount).
4. Rerun the same scan and review the full output. Treat a missing finding as
   limited evidence, not a security certification.
