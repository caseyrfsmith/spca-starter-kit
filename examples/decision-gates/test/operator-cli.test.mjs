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

test('operator --demo drives a non-pass route offline', () => {
  const result = run(['plan', '--ticket', 'tickets/example-ticket.json', '--demo', '{"failureMode":{"choice":"vague","confidence":0.9}}', '--json']);
  assert.equal(result.status, 0);
  const brief = JSON.parse(result.stdout);
  assert.equal(brief.route, 'revise');
  assert.equal(brief.actions.openPullRequest, false);
  assert.ok(brief.diagnosis, 'a revise verdict is diagnosed');
});

test('operator run refuses a pull request the route does not authorize', () => {
  const result = run(['run', '--ticket', 'tickets/example-ticket.json', '--demo', '{"failureMode":{"choice":"vague","confidence":0.9}}', '--pr', '--branch', 'x', '--paths', 'README.md', '--pr-title', 'T']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /does not authorize a pull request/);
});

test('operator run --dry-run previews the tracker attachment too', () => {
  const result = run(['run', '--ticket', 'tickets/example-ticket.json', '--pr', '--repo', '.', '--branch', 'b', '--paths', 'README.md', '--pr-title', 'T', '--tracker', 'linear', '--dry-run']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /would attach \(the new pull request\) to/);
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
