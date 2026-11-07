// Decision-gate providers.
//
// A provider turns a `state` and a set of typed `questions` into typed
// `answers`. Three implementations are included:
//
//   stub       Deterministic fixtures. Used by the offline tests and the demo
//              run. No network access.
//   openai     Any OpenAI-shaped chat endpoint (base URL + key + model). The
//              model is asked for a JSON object of typed decisions, which this
//              module validates before returning.
//   decisions  A Decisions API that returns typed answers directly (TypeSafe
//              Jev and similar). No text to parse.
//
// Keys are read by the caller and passed in; nothing here reads or stores them.

const DEFAULT_OPENAI_BASE = 'https://openrouter.ai/api/v1';
const DEFAULT_DECISIONS_BASE = 'https://openrouter.ai/api';

export const QUESTION_SYSTEM_PROMPT = [
  'You answer only with a JSON object of typed decisions, one entry per question id.',
  'A "noul" question expects {"probability": <number between 0 and 1>}: the probability that the stated proposition holds.',
  'A "choice" question expects {"choice": "<one of the criteria keys>"}.',
  'A "score" question expects {"score": <number>}.',
  'Return no prose and no markdown fences.',
  'If the evidence is insufficient, put that uncertainty into the probability rather than inventing facts.',
].join(' ');

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

// A confidence, when supplied, must be a real number in [0, 1]. A missing
// confidence stays null and is treated as "not confident" by the router, so a
// provider that omits it cannot silently auto-action a pass or a revise.
function normalizeConfidence(value, id) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 1) {
    throw new Error(`answer "${id}" has an invalid confidence`);
  }
  return value;
}

// Validate a raw answer object against the question set and return the
// normalized shape used by the routing code.
export function normalizeAnswers(raw, questions) {
  const out = {};
  for (const [id, question] of Object.entries(questions)) {
    const answer = raw[id];
    if (answer === undefined || answer === null) {
      throw new Error(`provider returned no answer for "${id}"`);
    }
    if (question.type === 'noul') {
      const probability = answer.probability ?? answer.noul ?? (typeof answer === 'number' ? answer : undefined);
      if (typeof probability !== 'number' || Number.isNaN(probability)) {
        throw new Error(`answer "${id}" is not a probability`);
      }
      out[id] = { type: 'noul', probability: clamp01(probability) };
    } else if (question.type === 'choice') {
      const options = Object.keys(question.criteria ?? {});
      if (options.length && !options.includes(answer.choice)) {
        throw new Error(`answer "${id}" is not one of: ${options.join(', ')}`);
      }
      out[id] = { type: 'choice', choice: answer.choice, confidence: normalizeConfidence(answer.confidence, id) };
    } else if (question.type === 'score') {
      if (typeof answer.score !== 'number' || Number.isNaN(answer.score)) {
        throw new Error(`answer "${id}" is not a score`);
      }
      out[id] = { type: 'score', score: answer.score, confidence: normalizeConfidence(answer.confidence, id) };
    } else {
      throw new Error(`unknown question type "${question.type}" for "${id}"`);
    }
  }
  return out;
}

export function stubProvider(fixtures) {
  return {
    name: 'stub',
    model: 'stub',
    async ask({ questions }) {
      return normalizeAnswers(fixtures, questions);
    },
  };
}

export function openAiProvider({ baseUrl = DEFAULT_OPENAI_BASE, apiKey, model, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error('openAiProvider needs an apiKey');
  if (!model) throw new Error('openAiProvider needs a model');
  return {
    name: 'openai',
    model,
    async ask({ state, questions }) {
      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: QUESTION_SYSTEM_PROMPT },
            { role: 'user', content: JSON.stringify({ state, questions }) },
          ],
        }),
      });
      if (!response.ok) throw new Error(`openai provider HTTP ${response.status}`);
      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content ?? '';
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('openai provider returned text that was not JSON');
      }
      return normalizeAnswers(parsed, questions);
    },
  };
}

export function decisionsProvider({ baseUrl = DEFAULT_DECISIONS_BASE, apiKey, model = 'typesafe/jev-1.14', fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error('decisionsProvider needs an apiKey');
  return {
    name: 'decisions',
    model,
    async ask({ state, questions }) {
      const response = await fetchImpl(`${baseUrl}/alpha/decisions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, state, questions }),
      });
      if (!response.ok) throw new Error(`decisions provider HTTP ${response.status}`);
      const data = await response.json();
      return normalizeAnswers(data.answers ?? {}, questions);
    },
  };
}
