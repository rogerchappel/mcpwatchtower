#!/usr/bin/env bash
set -euo pipefail

consumer_dir=$(mktemp -d "${TMPDIR:-/tmp}/mcpwatchtower-package-smoke.XXXXXX")
trap 'rm -rf "$consumer_dir"' EXIT

package_file=$(npm pack --pack-destination "$consumer_dir" --json | node -e '
  let input = "";
  process.stdin.on("data", (chunk) => input += chunk);
  process.stdin.on("end", () => process.stdout.write(JSON.parse(input)[0].filename));
')

cd "$consumer_dir"
npm init --yes >/dev/null
npm install --ignore-scripts "$consumer_dir/$package_file" >/dev/null

example_path="node_modules/mcpwatchtower/examples/risky.mcp.json"
test -f "$example_path"

set +e
node_modules/.bin/mcpwatchtower scan "$example_path" --format json --fail-on medium >scan.json
scan_status=$?
set -e

if [[ $scan_status -ne 1 ]]; then
  echo "expected packaged CLI to report findings with exit code 1, got $scan_status" >&2
  exit 1
fi

node -e '
  const report = require("./scan.json");
  if (!Array.isArray(report.findings) || report.findings.length === 0) {
    throw new Error("packaged CLI did not report findings for shipped risky example");
  }
'

echo "package smoke passed: installed $package_file and scanned the shipped risky example"
