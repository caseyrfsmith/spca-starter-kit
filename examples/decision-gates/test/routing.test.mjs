import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUTES, severity, combine, withConfidence, routeChoice, routeBand } from '../src/routing.mjs';

test('routes are ordered by severity', () => {
  assert.deepEqual(ROUTES, ['pass', 'revise', 'escalate', 'stop']);
  assert.ok(severity('stop') > severity('escalate'));
  assert.ok(severity('escalate') > severity('revise'));
  assert.ok(severity('revise') > severity('pass'));
  assert.throws(() => severity('nope'), /unknown route/);
});

test('combine returns the most severe route and never hides a failure', () => {
  assert.equal(combine(['pass', 'escalate', 'revise']), 'escalate');
  assert.equal(combine(['pass', 'stop', 'revise']), 'stop');
  assert.equal(combine(['pass', 'pass']), 'pass');
  assert.equal(combine([]), 'pass');
});

test('a low-confidence pass or revise escalates', () => {
  assert.equal(withConfidence('pass', 0.9, 0.6), 'pass');
  assert.equal(withConfidence('pass', 0.6, 0.6), 'pass');
  assert.equal(withConfidence('pass', 0.59, 0.6), 'escalate');
  assert.equal(withConfidence('revise', 0.4, 0.6), 'escalate');
});

test('stop and escalate are never downgraded by confidence', () => {
  assert.equal(withConfidence('escalate', 0.01, 0.6), 'escalate');
  assert.equal(withConfidence('stop', 0.01, 0.6), 'stop');
});

test('withConfidence is a no-op when no band is set', () => {
  assert.equal(withConfidence('pass', 0.01, undefined), 'pass');
});

test('routeBand resolves boundaries to the stronger band', () => {
  const bands = { passAt: 0.8, reviseAt: 0.4 };
  assert.equal(routeBand(1, bands), 'pass');
  assert.equal(routeBand(0.8, bands), 'pass');
  assert.equal(routeBand(0.79, bands), 'escalate');
  assert.equal(routeBand(0.41, bands), 'escalate');
  assert.equal(routeBand(0.4, bands), 'revise');
  assert.equal(routeBand(0, bands), 'revise');
});

test('routeChoice maps criteria to routes and applies the review band', () => {
  const routes = { bug: 'pass', copy: 'revise' };
  assert.equal(routeChoice({ choice: 'bug', confidence: 0.9 }, routes, 0.6), 'pass');
  assert.equal(routeChoice({ choice: 'bug', confidence: 0.2 }, routes, 0.6), 'escalate');
  assert.equal(routeChoice({ choice: 'copy', confidence: 0.9 }, routes, 0.6), 'revise');
  assert.equal(routeChoice({ choice: 'copy', confidence: undefined }, routes, 0.6), 'revise');
});

test('routeChoice rejects an unmapped criterion', () => {
  assert.throws(() => routeChoice({ choice: 'other' }, { bug: 'pass' }, 0.6), /no route/);
});
