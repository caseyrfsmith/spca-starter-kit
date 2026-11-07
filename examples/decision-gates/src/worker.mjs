// The escalation worker: the diagnoser.
//
// A decision gate decides. When a gate does not pass, the worker explains: it
// diagnoses *why* a ticket or draft is vague or incomplete, and it proposes
// specific, testable improvements.
//
// The worker never changes the route. The gate stays authoritative, and the
// worker's output is advisory prose that gives a human the specific things to
// fix. This is the "route-then-write" pattern: the gate routes, the worker
// writes.
//
// Providers:
//   stub-worker  Deterministic fixture. Offline tests and the demo.
//   worker       Any OpenAI-shaped chat endpoint. The model is asked for a JSON
//                diagnosis, which this module validates before returning.

import { requireHttpsBaseUrl } from './provider.mjs';

const DEFAULT_WORKER_BASE = 'https://openrouter.ai/api/v1';

export const WORKER_SYSTEM_PROMPT = [
  'You are a reviewer for tickets and documentation.',
  'You do not decide whether a ticket is acceptable: a decision gate already made that decision.',
  'You do not change the route, and you do not say whether the ticket should pass.',
  'You diagnose why the ticket is vague or incomplete and propose specific, testable improvements.',
  'Return only a JSON object with these fields:',
  '  "summary": one sentence describing the problem.',
  '  "vague": an array of strings; each quotes or names a vague or subjective phrase.',
  '  "missing": an array of strings; each names information that is absent.',
  '  "suggested": an array of strings; each is a specific, testable improvement.',
  'Do not invent facts. Do not restate the ticket at length. Return no prose and no markdown fences.',
].join(' ');

// Validate a diagnosis object and return the normalized shape.
export function validateDiagnosis(raw) {
  let obj = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      throw new Error('diagnosis was not JSON');
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error('diagnosis is not an object');
  }
  if (typeof obj.summary !== 'string') throw new Error('diagnosis.summary is not a string');
  for (const key of ['vague', 'missing', 'suggested']) {
    if (!Array.isArray(obj[key])) throw new Error(`diagnosis.${key} is not an array`);
    obj[key] = obj[key].map(String);
  }
  return {
    summary: obj.summary,
    vague: obj.vague,
    missing: obj.missing,
    suggested: obj.suggested,
  };
}

// Render a diagnosis as Markdown, ready to post as a tracker comment or a
// review note. The gate's route is included so the reader sees the decision and
// the explanation together.
export function formatDiagnosis(diagnosis, { gate, route } = {}) {
  const heading = gate ? `**Decision gate \`${gate}\`: route \`${route}\`**` : '**Diagnosis**';
  const sections = [heading, '', diagnosis.summary];
  if (diagnosis.vague.length) sections.push('', '**Vague or subjective**', ...diagnosis.vague.map((item) => `- ${item}`));
  if (diagnosis.missing.length) sections.push('', '**Missing**', ...diagnosis.missing.map((item) => `- ${item}`));
  if (diagnosis.suggested.length) sections.push('', '**Suggested**', ...diagnosis.suggested.map((item) => `- ${item}`));
  return sections.join('\n');
}

export function stubWorker(fixture) {
  return {
    name: 'stub-worker',
    model: 'stub-worker',
    async diagnose() {
      return validateDiagnosis(fixture);
    },
  };
}

export function workerProvider({ baseUrl = DEFAULT_WORKER_BASE, apiKey, model, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error('workerProvider needs an apiKey');
  if (!model) throw new Error('workerProvider needs a model');
  requireHttpsBaseUrl(baseUrl, 'worker base URL');
  return {
    name: 'worker',
    model,
    async diagnose({ gate, result, state }) {
      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: WORKER_SYSTEM_PROMPT },
            {
              role: 'user',
              content: JSON.stringify({
                gate: { id: gate.id, summary: gate.summary, questions: gate.questions },
                decision: {
                  route: result.route,
                  choice: result.choice ?? null,
                  probability: result.probability ?? null,
                  reason: result.reason ?? null,
                },
                state,
              }),
            },
          ],
        }),
      });
      if (!response.ok) throw new Error(`worker provider HTTP ${response.status}`);
      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content ?? '';
      return validateDiagnosis(text);
    },
  };
}
