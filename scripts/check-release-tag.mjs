#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

export function expectedReleaseTag(version) {
  return `v${version}`;
}

export function assertReleaseTag(tag, version) {
  const expected = expectedReleaseTag(version);
  if (tag !== expected) {
    throw new Error(`Release tag must be exactly ${expected}; received ${JSON.stringify(tag)}`);
  }
}

async function main() {
  const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;
  const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assertReleaseTag(tag, version);
  console.log(`Release tag ${tag} matches package version ${version}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
