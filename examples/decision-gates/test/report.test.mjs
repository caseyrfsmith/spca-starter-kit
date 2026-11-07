import test from 'node:test';
import assert from 'node:assert/strict';
import { formatQueue } from '../src/report.mjs';

test('formatQueue lists action items first, sorted by severity, with a summary', () => {
  const items = [
    { id: 'a', title: 'A clear one', result: { route: 'pass', reason: 'ok' } },
    { id: 'b', title: 'A vague one', result: { route: 'revise', reason: 'too vague', diagnosis: { summary: 'Subjective.', vague: ['feels fast'], missing: [], suggested: ['set a target'] } } },
    { id: 'c', title: 'A missing one', result: { route: 'escalate', reason: 'material not included' } },
  ];
  const text = formatQueue(items, { gate: 'testable-criteria', provider: 'stub' });
  assert.match(text, /ACTION NEEDED \(2\)/);
  assert.match(text, /CLEAR \(1\)/);
  assert.ok(text.indexOf('ACTION NEEDED') < text.indexOf('CLEAR'));
  assert.ok(text.indexOf('A missing one') < text.indexOf('A vague one'), 'escalate sorts before revise');
  assert.match(text, /diagnosis: Subjective\./);
  assert.match(text, /vague: feels fast/);
  assert.match(text, /3 tickets/);
});

test('formatQueue handles a passing queue with no action section', () => {
  const text = formatQueue([{ id: 'a', title: 'A', result: { route: 'pass' } }], { gate: 'g', provider: 'p' });
  assert.equal(text.includes('ACTION NEEDED'), false);
  assert.match(text, /CLEAR \(1\)/);
  assert.match(text, /1 ticket\b/);
});

test('formatQueue handles an empty queue', () => {
  const text = formatQueue([], { gate: 'g', provider: 'p' });
  assert.match(text, /0 tickets/);
});
