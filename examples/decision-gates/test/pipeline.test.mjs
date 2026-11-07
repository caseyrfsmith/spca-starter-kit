import test from 'node:test';
import assert from 'node:assert/strict';
import { stubProvider } from '../src/provider.mjs';
import { runGates } from '../src/gate.mjs';
import { getGate } from '../src/gates/index.mjs';
import { runCascade, verifyCascade } from '../src/pipeline.mjs';

test('the cascade passes a supported draft and names the gate', async () => {
  const result = await runCascade(stubProvider({ evidence: { choice: 'supported', confidence: 0.9 } }), { draft: '', source: '' });
  assert.equal(result.route, 'pass');
  assert.equal(result.results[0].gate, 'claim-grounded');
});

test('the cascade routes an unsupported draft to revise', async () => {
  const result = await runCascade(stubProvider({ evidence: { choice: 'unsupported', confidence: 0.9 } }), { draft: '', source: '' });
  assert.equal(result.route, 'revise');
});

test('the cascade escalates when the source is missing', async () => {
  const result = await runCascade(stubProvider({ evidence: { choice: 'missing', confidence: 0.9 } }), { draft: '', source: '' });
  assert.equal(result.route, 'escalate');
});

test('the cascade escalates a low-confidence classification', async () => {
  const result = await runCascade(stubProvider({ evidence: { choice: 'supported', confidence: 0.3 } }), { draft: '', source: '' });
  assert.equal(result.route, 'escalate');
});

test('runGates combines several routes by severity', async () => {
  const gate = getGate('claim-grounded');
  const combined = await runGates([gate, gate], stubProvider({ evidence: { choice: 'unsupported', confidence: 0.9 } }), {});
  assert.equal(combined.route, 'revise');
  assert.equal(combined.results.length, 2);
});

test('verifyCascade contains the verification gates', () => {
  assert.deepEqual(verifyCascade.map((gate) => gate.id), ['claim-grounded']);
});
