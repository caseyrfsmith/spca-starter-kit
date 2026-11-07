import test from 'node:test';
import assert from 'node:assert/strict';
import { docShape, runChecks } from '../src/checks.mjs';
import { runPipeline } from '../src/pipeline.mjs';
import { stubProvider } from '../src/provider.mjs';

test('docShape passes when the headings are present and there is no TODO', () => {
  const result = docShape({ markdown: '# Title\n\n## Summary\n\nBody.', requiredHeadings: ['Summary'] });
  assert.equal(result.route, 'pass');
  assert.deepEqual(result.findings, []);
});

test('docShape revises on a missing heading', () => {
  const result = docShape({ markdown: '# Title', requiredHeadings: ['Summary'] });
  assert.equal(result.route, 'revise');
  assert.ok(result.findings.some((finding) => finding.rule === 'missing-heading'));
});

test('docShape revises on an unresolved TODO', () => {
  const result = docShape({ markdown: '# Title\n\nTODO: finish this', requiredHeadings: [] });
  assert.equal(result.route, 'revise');
  assert.ok(result.findings.some((finding) => finding.rule === 'unresolved-todo'));
});

test('runChecks combines deterministic routes and is a pass with no checks', () => {
  assert.equal(runChecks([docShape], { markdown: '# T', requiredHeadings: [] }).route, 'pass');
  assert.equal(runChecks([docShape], { markdown: '# T\n\nTODO', requiredHeadings: [] }).route, 'revise');
  assert.deepEqual(runChecks([], {}), { route: 'pass', results: [] });
});

test('the pipeline runs deterministic checks first and never calls the gate on failure', async () => {
  let gateCalls = 0;
  const countingProvider = {
    name: 'counting',
    model: null,
    async ask() {
      gateCalls += 1;
      return { evidence: { choice: 'supported', confidence: 0.9 } };
    },
  };
  const blocked = await runPipeline(countingProvider, { markdown: 'TODO', draft: '', source: '' }, { checks: [docShape] });
  assert.equal(blocked.route, 'revise');
  assert.equal(blocked.blockedBy, 'deterministic');
  assert.equal(blocked.results.length, 0);
  assert.equal(gateCalls, 0, 'the gate must not run when a deterministic check fails');
});

test('the pipeline runs the gates when deterministic checks pass', async () => {
  const provider = stubProvider({ evidence: { choice: 'supported', confidence: 0.9 } });
  const result = await runPipeline(provider, { markdown: '# Title', draft: '', source: '' }, { checks: [docShape] });
  assert.equal(result.route, 'pass');
  assert.equal(result.results[0].gate, 'claim-grounded');
});
