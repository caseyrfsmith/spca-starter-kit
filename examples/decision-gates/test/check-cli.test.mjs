import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const run = (args) => spawnSync(process.execPath, ['bin/check.mjs', ...args], { cwd: root, encoding: 'utf8' });

test('check runs the deterministic shape check and prints a route', () => {
  const result = run(['tickets/example-ticket.json']);
  assert.equal(result.status, 0);
  assert.ok(JSON.parse(result.stdout).route);
});

test('check --require needs a heading and fails loudly without one', () => {
  const result = run(['tickets/example-ticket.json', '--require']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--require needs a heading/);
});
