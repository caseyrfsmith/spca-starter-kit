import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDiagnosis, stubWorker, workerProvider, formatDiagnosis, WORKER_SYSTEM_PROMPT } from '../src/worker.mjs';

test('validateDiagnosis accepts a complete object and coerces entries to strings', () => {
  const diagnosis = validateDiagnosis({ summary: 's', vague: [1], missing: [], suggested: ['x'] });
  assert.deepEqual(diagnosis, { summary: 's', vague: ['1'], missing: [], suggested: ['x'] });
});

test('validateDiagnosis parses a JSON string', () => {
  const diagnosis = validateDiagnosis('{"summary":"s","vague":[],"missing":[],"suggested":[]}');
  assert.equal(diagnosis.summary, 's');
});

test('validateDiagnosis rejects a malformed diagnosis', () => {
  assert.throws(() => validateDiagnosis('not json'), /not JSON/);
  assert.throws(() => validateDiagnosis({ vague: [], missing: [], suggested: [] }), /summary/);
  assert.throws(() => validateDiagnosis({ summary: 's', vague: 'x', missing: [], suggested: [] }), /vague/);
});

test('the worker prompt forbids deciding', () => {
  assert.match(WORKER_SYSTEM_PROMPT, /do not decide/i);
  assert.match(WORKER_SYSTEM_PROMPT, /do not change the route/i);
});

test('stubWorker returns its fixture', async () => {
  const worker = stubWorker({ summary: 's', vague: ['a'], missing: [], suggested: [] });
  const diagnosis = await worker.diagnose({});
  assert.equal(diagnosis.summary, 's');
  assert.deepEqual(diagnosis.vague, ['a']);
});

test('workerProvider posts to the chat endpoint and parses the diagnosis', async () => {
  let captured;
  const fetchImpl = async (url, options) => {
    captured = { url, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ summary: 's', vague: [], missing: ['m'], suggested: [] }) } }] }) };
  };
  const worker = workerProvider({ apiKey: 'test', model: 'm', fetchImpl });
  const diagnosis = await worker.diagnose({ gate: { id: 'g', summary: 'x', questions: {} }, result: { route: 'revise' }, state: {} });
  assert.equal(diagnosis.missing[0], 'm');
  assert.match(captured.url, /chat\/completions$/);
  assert.match(captured.body.messages[0].content, /do not decide/i);
});

test('workerProvider surfaces an HTTP error', async () => {
  const worker = workerProvider({ apiKey: 'test', model: 'm', fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }) });
  await assert.rejects(() => worker.diagnose({ gate: {}, result: {}, state: {} }), /HTTP 500/);
});

test('workerProvider requires a key and a model', () => {
  assert.throws(() => workerProvider({ model: 'm' }), /apiKey/);
  assert.throws(() => workerProvider({ apiKey: 'k' }), /model/);
});

test('formatDiagnosis renders a Markdown comment with the route and sections', () => {
  const md = formatDiagnosis(
    { summary: 'Too vague to verify.', vague: ['feels faster'], missing: ['a target'], suggested: ['loads in under 2s'] },
    { gate: 'testable-criteria', route: 'revise' },
  );
  assert.match(md, /testable-criteria/);
  assert.match(md, /revise/);
  assert.match(md, /Too vague to verify\./);
  assert.match(md, /- feels faster/);
  assert.match(md, /- a target/);
  assert.match(md, /- loads in under 2s/);
});

test('formatDiagnosis omits empty sections', () => {
  const md = formatDiagnosis({ summary: 'Only a summary.', vague: [], missing: [], suggested: [] });
  assert.equal(md.includes('Vague or subjective'), false);
  assert.equal(md.includes('Missing'), false);
});
