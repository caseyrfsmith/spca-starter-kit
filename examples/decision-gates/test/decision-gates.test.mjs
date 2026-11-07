import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stubProvider } from '../src/provider.mjs';
import { runGate, runGates, evaluate } from '../src/gate.mjs';
import { ROUTES } from '../src/routing.mjs';
import { gates, getGate, listGates } from '../src/gates/index.mjs';
import { stubWorker } from '../src/worker.mjs';
import { runEscalation } from '../src/escalate.mjs';

// Build stub answers that should make `gate` return `route`, or null if the
// gate cannot express that route. This lets the dataset be checked against the
// gate's policy without a live model.
function answersForRoute(gate, route) {
  const answers = {};
  for (const [id, question] of Object.entries(gate.questions)) {
    if (question.type === 'choice') {
      const key = Object.keys(question.criteria).find((candidate) => gate.policy.routes[candidate] === route);
      if (!key) return null;
      answers[id] = { choice: key, confidence: 1 };
    } else if (question.type === 'noul') {
      const { passAt = 0.8, reviseAt = 0.4 } = gate.policy;
      const probability = route === 'pass' ? Math.min(0.99, passAt + 0.1)
        : route === 'revise' ? Math.max(0.01, reviseAt - 0.1)
          : (reviseAt + passAt) / 2;
      answers[id] = { probability };
    } else {
      return null;
    }
  }
  return answers;
}

function readDataset(id) {
  return readFileSync(new URL(`../data/${id}.jsonl`, import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

test('the registry lists four gates and resolves them by id', () => {
  assert.deepEqual(listGates().map((gate) => gate.id), ['testable-criteria', 'docs-needed', 'claim-grounded', 'answerable']);
  assert.equal(getGate('answerable').id, 'answerable');
  assert.throws(() => getGate('nope'), /unknown gate/);
  assert.equal(gates.length, 4);
});

test('every gate is well formed', () => {
  for (const gate of gates) {
    assert.ok(gate.id && gate.version && gate.summary, `${gate.id} metadata`);
    assert.ok(gate.questions && Object.keys(gate.questions).length > 0, `${gate.id} questions`);
    assert.equal(typeof gate.decide, 'function', `${gate.id} decide`);
    assert.ok(gate.demo, `${gate.id} demo fixtures`);
  }
});

test('every choice criterion is routed and every route is known', () => {
  for (const gate of gates) {
    for (const [id, question] of Object.entries(gate.questions)) {
      if (question.type !== 'choice') continue;
      for (const key of Object.keys(question.criteria)) {
        const route = gate.policy.routes[key];
        assert.ok(route, `${gate.id}/${id}: criterion "${key}" has no route`);
        assert.ok(ROUTES.includes(route), `${gate.id}/${id}: unknown route "${route}"`);
      }
    }
  }
});

test('every gate demo answers exactly its questions and runs offline', async () => {
  for (const gate of gates) {
    assert.deepEqual(Object.keys(gate.demo).sort(), Object.keys(gate.questions).sort(), `${gate.id} demo keys`);
    const result = await runGate(gate, stubProvider(gate.demo), {});
    assert.ok(ROUTES.includes(result.route), `${gate.id} demo route`);
  }
});

test('every gate ships a labeled dataset with known routes and unique ids', () => {
  for (const gate of gates) {
    const rows = readDataset(gate.id);
    assert.ok(rows.length > 0, `${gate.id} dataset is empty`);
    const seen = new Set();
    for (const row of rows) {
      assert.ok(row.id && !seen.has(row.id), `${gate.id} duplicate id ${row.id}`);
      seen.add(row.id);
      assert.ok(ROUTES.includes(row.expected), `${gate.id}/${row.id} bad expected route "${row.expected}"`);
      assert.ok(row.state && typeof row.state === 'object', `${gate.id}/${row.id} missing state`);
    }
  }
});

test('each dataset row is reachable by its gate policy', async () => {
  for (const gate of gates) {
    for (const row of readDataset(gate.id)) {
      const answers = answersForRoute(gate, row.expected);
      assert.ok(answers, `${gate.id}/${row.id}: gate cannot express route "${row.expected}"`);
      const result = await runGate(gate, stubProvider(answers), row.state);
      assert.equal(result.route, row.expected, `${gate.id}/${row.id} routed ${result.route}`);
    }
  }
});

test('testable-criteria routes each failure mode', async () => {
  const gate = getGate('testable-criteria');
  const at = async (choice, confidence = 0.9) => (await runGate(gate, stubProvider({ failureMode: { choice, confidence } }), {})).route;
  assert.equal(await at('observable'), 'pass');
  assert.equal(await at('vague'), 'revise');
  assert.equal(await at('absent'), 'revise');
  assert.equal(await at('deferred'), 'escalate');
  assert.equal(await at('vague', 0.2), 'escalate');
});

test('docs-needed separates required, not required and unclear', async () => {
  const gate = getGate('docs-needed');
  const at = async (choice, confidence = 0.9) => (await runGate(gate, stubProvider({ impact: { choice, confidence } }), {})).route;
  assert.equal(await at('required'), 'pass');
  assert.equal(await at('not_required'), 'stop');
  assert.equal(await at('unclear'), 'escalate');
});

test('claim-grounded separates unsupported from a missing source', async () => {
  const gate = getGate('claim-grounded');
  const at = async (choice, confidence = 0.9) => (await runGate(gate, stubProvider({ evidence: { choice, confidence } }), {})).route;
  assert.equal(await at('supported'), 'pass');
  assert.equal(await at('unsupported'), 'revise');
  assert.equal(await at('missing'), 'escalate');
});

test('answerable hands off when the context does not answer', async () => {
  const gate = getGate('answerable');
  assert.equal((await runGate(gate, stubProvider({ answerable: { probability: 0.95 } }), {})).route, 'pass');
  assert.equal((await runGate(gate, stubProvider({ answerable: { probability: 0.6 } }), {})).route, 'escalate');
  assert.equal((await runGate(gate, stubProvider({ answerable: { probability: 0.1 } }), {})).route, 'escalate');
});

test('evaluate counts false approvals and false rejections separately', () => {
  const rows = [
    { id: 'a', expected: 'pass', result: { route: 'revise' } },
    { id: 'b', expected: 'revise', result: { route: 'pass' } },
    { id: 'c', expected: 'pass', result: { route: 'pass' } },
    { id: 'd', expected: 'escalate', result: { route: 'escalate' } },
  ];
  const metrics = evaluate(rows);
  assert.equal(metrics.total, 4);
  assert.equal(metrics.correct, 2);
  assert.equal(metrics.falseApprovals, 1);
  assert.equal(metrics.falseRejections, 1);
});

test('evaluate rejects an unknown expected route', () => {
  assert.throws(() => evaluate([{ id: 'x', expected: 'maybe', result: { route: 'pass' } }]), /unknown expected route/);
});

test('every gate ships an escalation fixture that is diagnosed offline', async () => {
  for (const gate of gates) {
    assert.ok(gate.escalation?.decision, `${gate.id} escalation decision`);
    assert.ok(gate.escalation?.diagnosis, `${gate.id} escalation diagnosis`);
    const result = await runEscalation({
      gate,
      provider: stubProvider(gate.escalation.decision),
      worker: stubWorker(gate.escalation.diagnosis),
      state: {},
    });
    assert.ok(['revise', 'escalate', 'review'].includes(result.route), `${gate.id} escalation route "${result.route}"`);
    assert.equal(result.escalated, true, `${gate.id} should escalate`);
    assert.ok(result.diagnosis.summary.length > 0, `${gate.id} diagnosis summary`);
  }
});
