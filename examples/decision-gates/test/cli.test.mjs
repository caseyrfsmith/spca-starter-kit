import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const run = (args) => spawnSync(process.execPath, ['bin/gate.mjs', ...args], { cwd: root, encoding: 'utf8' });

test('--list prints every gate', () => {
  const result = run(['--list']);
  assert.equal(result.status, 0);
  const list = JSON.parse(result.stdout);
  assert.deepEqual(list.map((gate) => gate.id), ['testable-criteria', 'docs-needed', 'claim-grounded', 'answerable']);
});

test('--ticket runs the default gate offline with the stub', () => {
  const result = run(['--ticket', 'tickets/example-ticket.json']);
  assert.equal(result.status, 0);
  const verdict = JSON.parse(result.stdout);
  assert.equal(verdict.gate, 'testable-criteria');
  assert.equal(verdict.route, 'pass');
  assert.match(verdict.note, /DEMO/);
});

test('--gate selects a gate', () => {
  const result = run(['--gate', 'docs-needed', '--ticket', 'tickets/example-ticket.json']);
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).gate, 'docs-needed');
});

test('--help exits zero and prints usage', () => {
  const result = run(['--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
});

test('an unknown gate fails loudly', () => {
  const result = run(['--gate', 'nope', '--ticket', 'tickets/example-ticket.json']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown gate/);
});

test('a missing input file fails loudly', () => {
  const result = run(['--ticket', 'tickets/does-not-exist.json']);
  assert.equal(result.status, 1);
  assert.ok(result.stderr.length > 0);
});
