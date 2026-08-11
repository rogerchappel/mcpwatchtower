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

run_finding_scan() {
  local output_file=$1
  shift

  set +e
  "$@" >"$output_file"
  local scan_status=$?
  set -e

  if [[ $scan_status -ne 1 ]]; then
    echo "expected packaged CLI to report findings with exit code 1, got $scan_status" >&2
    exit 1
  fi
}

run_finding_scan npx-scan.json env npm_config_offline=true npx mcpwatchtower scan "$example_path" --format json --fail-on medium
run_finding_scan binary-scan.json node_modules/.bin/mcpwatchtower scan "$example_path" --format json --fail-on medium
run_finding_scan stdin-scan.json node_modules/.bin/mcpwatchtower scan - --format json --fail-on medium <"$example_path"

node -e '
  const fs = require("node:fs");
  for (const output of ["npx-scan.json", "binary-scan.json", "stdin-scan.json"]) {
    const report = JSON.parse(fs.readFileSync(output, "utf8"));
    if (!Array.isArray(report.findings) || report.findings.length === 0) {
      throw new Error(`${output} did not report findings for the shipped risky example`);
    }
  }
'

node --input-type=module -e '
  import { scanConfig } from "mcpwatchtower";
  const report = scanConfig("consumer-test", JSON.stringify({
    mcpServers: { safe: { command: "node", args: ["server.js"] } }
  }));
  if (report.serverCount !== 1 || report.findings.length !== 0) {
    throw new Error("root package import did not scan the clean consumer fixture");
  }
'

echo "package smoke passed: installed $package_file; exercised npx, binary, stdin, and root import"
