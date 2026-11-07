import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUTES } from '../src/routing.mjs';
import { defaultPolicy, planBrief, formatBrief, formatComment, canOpenPullRequest, policyCoversAllRoutes } from '../src/operator.mjs';

const passResult = {
  gate: 'testable-criteria',
  version: '0.3',
  provider: 'decisions',
  model: 'typesafe/jev-1.14',
  route: 'pass',
  choice: 'observable',
  confidence: 0.97,
  reason: 'criteria describe observable outcomes',
};

const reviseResult = {
  ...passResult,
  route: 'revise',
  choice: 'vague',
  confidence: 0.9,
  escalated: true,
  diagnosis: { summary: 'too vague to verify', vague: ['feels faster'], missing: ['a target'], suggested: ['loads in under 2s'] },
  comment: '**Decision gate `testable-criteria`: route `revise`**\n\ntoo vague to verify',
};

test('every route has an operator policy', () => {
  assert.equal(policyCoversAllRoutes(), true);
  for (const route of ROUTES) assert.ok(defaultPolicy[route], `no policy for "${route}"`);
});

test('a pass proceeds and authorizes a pull request', () => {
  const brief = planBrief({ id: 'SLO-10', ticket: { title: 'Publish the pages' }, result: passResult });
  assert.equal(brief.disposition, 'proceed');
  assert.equal(brief.actions.label, 'gate-passed');
  assert.equal(brief.actions.state, 'In Progress');
  assert.equal(brief.actions.openPullRequest, true);
  assert.equal(canOpenPullRequest(brief), true);
  assert.match(brief.comment, /route `pass`/);
  assert.match(brief.comment, /not a substitute for review/);
});

test('a revise returns to the author and does not authorize a pull request', () => {
  const brief = planBrief({ id: 'SLO-7', ticket: {}, result: reviseResult });
  assert.equal(brief.disposition, 'revise');
  assert.equal(brief.actions.label, 'gate-needs-criteria');
  assert.equal(brief.actions.openPullRequest, false);
  assert.equal(canOpenPullRequest(brief), false);
  assert.equal(brief.comment, reviseResult.comment);
  assert.equal(brief.diagnosis.summary, 'too vague to verify');
});

test('an escalate goes to a person and does not authorize a pull request', () => {
  const brief = planBrief({ result: { ...passResult, route: 'escalate', choice: 'deferred', diagnosis: null, comment: null } });
  assert.equal(brief.disposition, 'review');
  assert.equal(brief.actions.label, 'gate-needs-context');
  assert.equal(brief.actions.openPullRequest, false);
});

test('a stop does not authorize a pull request', () => {
  const brief = planBrief({ result: { ...passResult, route: 'stop' } });
  assert.equal(brief.disposition, 'stop');
  assert.equal(brief.actions.openPullRequest, false);
});

test('a pass comment is generated deterministically from the result', () => {
  const first = planBrief({ id: 'x', ticket: {}, result: passResult }).comment;
  const second = planBrief({ id: 'x', ticket: {}, result: passResult }).comment;
  assert.equal(first, second);
  assert.match(first, /observable/);
  assert.match(first, /typesafe\/jev-1.14/);
});

test('a result with a route but no comment still gets one, and evidence follows the route', () => {
  const comment = formatComment({ ...passResult, route: 'revise', comment: undefined });
  assert.match(comment, /route `revise`/);
  assert.doesNotMatch(comment, /not a substitute for review/);
  assert.match(comment, /criteria describe observable outcomes/);
});

test('a probability carries into the comment and the brief', () => {
  const result = { gate: 'answerable', version: '0.1', provider: 'decisions', model: 'typesafe/jev-1.14', route: 'pass', probability: 0.93, reason: 'the question is answerable from the context' };
  const brief = planBrief({ id: 'q1', result });
  assert.equal(brief.probability, 0.93);
  assert.match(brief.comment, /probability: 0.93/);
});

test('an unknown route fails loudly', () => {
  assert.throws(() => planBrief({ result: { route: 'maybe' } }), /no operator policy/);
});

test('a result with no route fails loudly', () => {
  assert.throws(() => planBrief({ result: {} }), /needs a gate result/);
});

test('formatBrief names the route, the action and the next step', () => {
  const text = formatBrief(planBrief({ id: 'SLO-10', ticket: { title: 'Publish' }, result: passResult }));
  assert.match(text, /SLO-10/);
  assert.match(text, /route\s+pass\s+→\s+proceed/);
  assert.match(text, /gate-passed/);
  assert.match(text, /pull request: yes/);
});
