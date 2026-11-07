import test from 'node:test';
import assert from 'node:assert/strict';
import { stubProvider } from '../src/provider.mjs';
import { stubWorker } from '../src/worker.mjs';
import { runEscalation, DIAGNOSE_ROUTES } from '../src/escalate.mjs';
import { getGate } from '../src/gates/index.mjs';

const diagnosis = { summary: 'too vague to verify', vague: ['feels faster'], missing: ['a target'], suggested: ['loads in under 2s'] };

test('a passing gate is not diagnosed', async () => {
  const gate = getGate('testable-criteria');
  const result = await runEscalation({ gate, provider: stubProvider({ failureMode: { choice: 'observable', confidence: 0.9 } }), worker: stubWorker(diagnosis), state: {} });
  assert.equal(result.route, 'pass');
  assert.equal(result.escalated, false);
  assert.equal(result.diagnosis, null);
  assert.equal(result.comment, null);
});

test('a revise verdict is diagnosed with specifics and a comment', async () => {
  const gate = getGate('testable-criteria');
  const result = await runEscalation({ gate, provider: stubProvider({ failureMode: { choice: 'vague', confidence: 0.9 } }), worker: stubWorker(diagnosis), state: {} });
  assert.equal(result.route, 'revise');
  assert.equal(result.escalated, true);
  assert.equal(result.diagnosis.summary, 'too vague to verify');
  assert.deepEqual(result.diagnosis.vague, ['feels faster']);
  assert.match(result.comment, /too vague to verify/);
  assert.match(result.comment, /- feels faster/);
});

test('the diagnosis never changes the gate route', async () => {
  const gate = getGate('claim-grounded');
  const result = await runEscalation({
    gate,
    provider: stubProvider({ evidence: { choice: 'missing', confidence: 0.9 } }),
    worker: stubWorker({ summary: 'this should pass', vague: [], missing: [], suggested: [] }),
    state: {},
  });
  assert.equal(result.route, 'escalate');
  assert.equal(result.escalated, true);
});

test('the default diagnose set is revise and escalate', () => {
  assert.deepEqual(DIAGNOSE_ROUTES, ['revise', 'escalate']);
});

test('a custom route set can restrict diagnosis', async () => {
  const gate = getGate('testable-criteria');
  const result = await runEscalation({
    gate,
    provider: stubProvider({ failureMode: { choice: 'vague', confidence: 0.9 } }),
    worker: stubWorker(diagnosis),
    state: {},
    routes: ['escalate'],
  });
  assert.equal(result.route, 'revise');
  assert.equal(result.escalated, false);
  assert.equal(result.diagnosis, null);
});
