import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const run = (args) => spawnSync(process.execPath, ['bin/operator.mjs', ...args], { cwd: root, encoding: 'utf8' });

test('operator plan prints a brief offline with the stub', () => {
  const result = run(['plan', '--ticket', 'tickets/example-ticket.json']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /route\s+pass\s+→\s+proceed/);
  assert.match(result.stdout, /gate-passed/);
});

test('operator plan --json emits the brief as JSON', () => {
  const result = run(['plan', '--ticket', 'tickets/example-ticket.json', '--json']);
  assert.equal(result.status, 0);
  const brief = JSON.parse(result.stdout);
  assert.equal(brief.route, 'pass');
  assert.equal(brief.actions.label, 'gate-passed');
  assert.equal(brief.disposition, 'proceed');
  assert.ok(brief.comment.length > 0);
});

test('plan is the default subcommand', () => {
  const result = run(['--ticket', 'tickets/example-ticket.json', '--json']);
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).route, 'pass');
});

test('operator run --dry-run previews the pull request without running it', () => {
  const result = run(['run', '--ticket', 'tickets/example-ticket.json', '--pr', '--repo', '.', '--branch', 'slo-x', '--paths', 'README.md', '--pr-title', 'T', '--dry-run']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /would run: git checkout -b slo-x/);
  assert.match(result.stdout, /would run: gh pr create/);
});

test('operator run --pr needs a branch, paths and title', () => {
  const result = run(['run', '--ticket', 'tickets/example-ticket.json', '--pr']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /needs --branch, --paths and --pr-title/);
});

test('operator --help exits zero and prints usage', () => {
  const result = run(['--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
});

test('operator without a ticket prints usage and exits two', () => {
  const result = run(['plan']);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /Usage:/);
});
