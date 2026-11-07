import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAnswers, stubProvider, openAiProvider, decisionsProvider, requireHttpsBaseUrl } from '../src/provider.mjs';

const QUESTIONS = {
  supported: { type: 'noul' },
  kind: { type: 'choice', criteria: { bug: 'a bug', copy: 'a copy change' } },
  effort: { type: 'score', criteria: ['small', 'medium', 'large'] },
};

test('normalizeAnswers accepts typed answers and clamps probabilities', () => {
  const answers = normalizeAnswers(
    { supported: { noul: 1.4 }, kind: { choice: 'bug' }, effort: { score: 2 } },
    QUESTIONS,
  );
  assert.deepEqual(answers.supported, { type: 'noul', probability: 1 });
  assert.equal(answers.kind.choice, 'bug');
  assert.equal(answers.effort.score, 2);
});

test('normalizeAnswers rejects a missing answer', () => {
  assert.throws(() => normalizeAnswers({ kind: { choice: 'bug' }, effort: { score: 1 } }, QUESTIONS), /no answer/);
});

test('normalizeAnswers rejects a non-numeric probability', () => {
  assert.throws(
    () => normalizeAnswers({ supported: { noul: 'high' }, kind: { choice: 'bug' }, effort: { score: 1 } }, QUESTIONS),
    /not a probability/,
  );
});

test('normalizeAnswers rejects an off-menu choice', () => {
  assert.throws(
    () => normalizeAnswers({ supported: { noul: 0.5 }, kind: { choice: 'mystery' }, effort: { score: 1 } }, QUESTIONS),
    /not one of/,
  );
});

test('normalizeAnswers rejects an invalid confidence', () => {
  assert.throws(
    () => normalizeAnswers({ supported: { noul: 0.5 }, kind: { choice: 'bug', confidence: 1.4 }, effort: { score: 1 } }, QUESTIONS),
    /invalid confidence/,
  );
  assert.throws(
    () => normalizeAnswers({ supported: { noul: 0.5 }, kind: { choice: 'bug', confidence: 'high' }, effort: { score: 1 } }, QUESTIONS),
    /invalid confidence/,
  );
});

test('normalizeAnswers keeps a missing confidence as null', () => {
  const answers = normalizeAnswers({ supported: { noul: 0.5 }, kind: { choice: 'bug' }, effort: { score: 1 } }, QUESTIONS);
  assert.equal(answers.kind.confidence, null);
});

test('normalizeAnswers rejects a non-numeric score', () => {
  assert.throws(
    () => normalizeAnswers({ supported: { noul: 0.5 }, kind: { choice: 'bug' }, effort: { score: 'big' } }, QUESTIONS),
    /not a score/,
  );
});

test('the stub provider echoes its fixtures through normalization', async () => {
  const provider = stubProvider({ supported: { probability: 0.42 } });
  const answers = await provider.ask({ questions: { supported: { type: 'noul' } } });
  assert.equal(answers.supported.probability, 0.42);
});

test('openAiProvider parses a JSON decision', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ supported: { probability: 0.7 } }) } }] }) });
  const provider = openAiProvider({ apiKey: 'test', model: 'm', fetchImpl });
  const answers = await provider.ask({ state: {}, questions: { supported: { type: 'noul' } } });
  assert.equal(answers.supported.probability, 0.7);
});

test('openAiProvider rejects a non-JSON reply', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'sure thing' } }] }) });
  const provider = openAiProvider({ apiKey: 'test', model: 'm', fetchImpl });
  await assert.rejects(() => provider.ask({ state: {}, questions: { supported: { type: 'noul' } } }), /not JSON/);
});

test('openAiProvider surfaces an HTTP error', async () => {
  const fetchImpl = async () => ({ ok: false, status: 429, json: async () => ({}) });
  const provider = openAiProvider({ apiKey: 'test', model: 'm', fetchImpl });
  await assert.rejects(() => provider.ask({ state: {}, questions: { supported: { type: 'noul' } } }), /HTTP 429/);
});

test('decisionsProvider reads typed answers without parsing text', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ answers: { supported: { type: 'noul', noul: 0.98 } } }) });
  const provider = decisionsProvider({ apiKey: 'test', fetchImpl });
  const answers = await provider.ask({ state: {}, questions: { supported: { type: 'noul' } } });
  assert.equal(answers.supported.probability, 0.98);
});

test('decisionsProvider surfaces an HTTP error', async () => {
  const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({}) });
  const provider = decisionsProvider({ apiKey: 'test', fetchImpl });
  await assert.rejects(() => provider.ask({ state: {}, questions: { supported: { type: 'noul' } } }), /HTTP 500/);
});

test('live providers refuse to construct without a key', () => {
  assert.throws(() => openAiProvider({ model: 'm' }), /apiKey/);
  assert.throws(() => decisionsProvider({}), /apiKey/);
});

test('a base URL must be https, except loopback http', () => {
  assert.equal(requireHttpsBaseUrl('https://api.example.com/v1'), 'https://api.example.com/v1');
  assert.equal(requireHttpsBaseUrl('http://localhost:8080/v1'), 'http://localhost:8080/v1');
  assert.equal(requireHttpsBaseUrl('http://127.0.0.1:3000'), 'http://127.0.0.1:3000');
  assert.throws(() => requireHttpsBaseUrl('http://api.example.com/v1'), /must be https/);
  assert.throws(() => requireHttpsBaseUrl('not a url'), /not a valid URL/);
});

test('the live providers refuse a non-https base URL', () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({}) });
  assert.throws(() => openAiProvider({ apiKey: 'k', model: 'm', baseUrl: 'http://api.example.com', fetchImpl }), /must be https/);
  assert.throws(() => decisionsProvider({ apiKey: 'k', baseUrl: 'http://api.example.com', fetchImpl }), /must be https/);
});
