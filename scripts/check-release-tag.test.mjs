import assert from 'node:assert/strict';
import test from 'node:test';

import { assertReleaseTag, expectedReleaseTag } from './check-release-tag.mjs';

test('accepts the exact v-prefixed package version', () => {
  assert.equal(expectedReleaseTag('0.1.0'), 'v0.1.0');
  assert.doesNotThrow(() => assertReleaseTag('v0.1.0', '0.1.0'));
});

for (const tag of ['v0.2.0', '0.1.0', 'vv0.1.0', 'v0.1', 'v0.1.0-beta.1', '', undefined]) {
  test(`rejects mismatched or malformed tag ${JSON.stringify(tag)}`, () => {
    assert.throws(
      () => assertReleaseTag(tag, '0.1.0'),
      /Release tag must be exactly v0\.1\.0/,
    );
  });
}
