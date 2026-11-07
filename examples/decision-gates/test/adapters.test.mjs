import test from 'node:test';
import assert from 'node:assert/strict';
import { gitPlan, formatCommand, createGitAdapter } from '../src/adapters/git.mjs';
import { createLinearAdapter } from '../src/adapters/linear.mjs';

// ---- git / gh ------------------------------------------------------------

test('gitPlan is a pure, ordered list of commands', () => {
  const plan = gitPlan({ branch: 'slo-10', paths: ['content/a.mdx', 'content/b.mdx'], message: 'msg', title: 'PR title', body: 'body', base: 'main' });
  assert.deepEqual(plan.map((step) => step.cmd), ['git', 'git', 'git', 'git', 'gh']);
  assert.deepEqual(plan[0].args, ['checkout', '-b', 'slo-10']);
  assert.deepEqual(plan[1].args, ['add', '--', 'content/a.mdx', 'content/b.mdx']);
  assert.deepEqual(plan[2].args, ['commit', '-m', 'msg']);
  assert.deepEqual(plan[3].args, ['push', '-u', 'origin', 'slo-10']);
  assert.deepEqual(plan[4].args.slice(0, 2), ['pr', 'create']);
  assert.ok(plan[4].args.includes('--base') && plan[4].args.includes('main'));
});

test('gitPlan refuses an incomplete plan', () => {
  assert.throws(() => gitPlan({ paths: ['a'], message: 'm', title: 't' }), /branch/);
  assert.throws(() => gitPlan({ branch: 'b', message: 'm', title: 't' }), /path/);
  assert.throws(() => gitPlan({ branch: 'b', paths: [], message: 'm', title: 't' }), /path/);
  assert.throws(() => gitPlan({ branch: 'b', paths: ['a'], title: 't' }), /commit message/);
  assert.throws(() => gitPlan({ branch: 'b', paths: ['a'], message: 'm' }), /title/);
});

test('the git adapter executes the plan in order', async () => {
  const seen = [];
  const adapter = createGitAdapter({ run: (step) => { seen.push(formatCommand(step)); return { status: 0, stdout: '', stderr: '' }; } });
  const results = await adapter.execute(gitPlan({ branch: 'b', paths: ['a'], message: 'm', title: 't' }));
  assert.equal(results.length, 5);
  assert.match(seen[0], /^git checkout -b b$/);
  assert.match(seen[4], /^gh pr create/);
});

test('the git adapter stops at the first failing step', async () => {
  let calls = 0;
  const adapter = createGitAdapter({ run: () => { calls += 1; return { status: 1, stdout: '', stderr: 'boom' }; } });
  await assert.rejects(() => adapter.execute(gitPlan({ branch: 'b', paths: ['a'], message: 'm', title: 't' })), /command failed/);
  assert.equal(calls, 1);
});

test('formatCommand quotes arguments containing whitespace with single quotes', () => {
  assert.equal(formatCommand({ cmd: 'git', args: ['commit', '-m', 'two words'] }), "git commit -m 'two words'");
  assert.equal(formatCommand({ cmd: 'git', args: ['add', '--', "it's.md"] }), "git add -- 'it'\\''s.md'");
});

test('formatCommand neutralizes shell substitutions in a pasted plan', () => {
  assert.equal(formatCommand({ cmd: 'git', args: ['add', '--', 'a$(id).md'] }), "git add -- 'a$(id).md'");
  assert.equal(formatCommand({ cmd: 'gh', args: ['pr', 'create', '--body', 'call `id`'] }), "gh pr create --body 'call `id`'");
});

// ---- Linear --------------------------------------------------------------

// A fetch that answers each GraphQL call from a handler and records the bodies.
function mockFetch(handler) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, auth: init.headers.authorization, ...body });
    return { ok: true, status: 200, json: async () => ({ data: handler(body) }) };
  };
  return { fetchImpl, calls };
}

const ticketData = {
  issue: {
    id: 'uuid-1',
    identifier: 'SLO-10',
    title: 'Publish the pages',
    description: 'D',
    url: 'https://linear.app/x/SLO-10',
    state: { id: 's1', name: 'Backlog' },
    team: {
      id: 't1',
      key: 'SLO',
      name: 'Slopcontrol',
      states: { nodes: [{ id: 's2', name: 'In Progress', type: 'started' }] },
      labels: { nodes: [{ id: 'l1', name: 'gate-passed' }] },
    },
    labels: { nodes: [{ id: 'l1', name: 'gate-passed' }] },
  },
};

test('the linear adapter needs a key', () => {
  assert.throws(() => createLinearAdapter({ apiKey: undefined }), /apiKey/);
});

test('the linear adapter reads a ticket by identifier', async () => {
  const { fetchImpl, calls } = mockFetch(() => ticketData);
  const linear = createLinearAdapter({ apiKey: 'k', fetchImpl });
  const ticket = await linear.getTicket('SLO-10');
  assert.equal(ticket.id, 'uuid-1');
  assert.equal(ticket.team.key, 'SLO');
  assert.deepEqual(ticket.labels, ['gate-passed']);
  assert.deepEqual(ticket.states, [{ id: 's2', name: 'In Progress', type: 'started' }]);
  assert.equal(calls[0].variables.id, 'SLO-10');
  assert.match(calls[0].query, /issue\(id: \$id\)/);
  assert.equal(calls[0].auth, 'k');
});

test('the linear adapter fails loudly when the issue is missing', async () => {
  const { fetchImpl } = mockFetch(() => ({ issue: null }));
  const linear = createLinearAdapter({ apiKey: 'k', fetchImpl });
  await assert.rejects(() => linear.getTicket('nope'), /not found/);
});

test('the linear adapter surfaces GraphQL errors', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ errors: [{ message: 'bad query' }] }) });
  const linear = createLinearAdapter({ apiKey: 'k', fetchImpl });
  await assert.rejects(() => linear.getTicket('x'), /bad query/);
});

test('the linear adapter applies a brief: label, state and comment', async () => {
  const { fetchImpl, calls } = mockFetch((body) => {
    if (body.query.includes('issueUpdate')) return { issueUpdate: { success: true, issue: { id: 'uuid-1' } } };
    if (body.query.includes('commentCreate')) return { commentCreate: { success: true, comment: { id: 'c1', url: 'https://linear.app/c1' } } };
    throw new Error(`unexpected query: ${body.query.slice(0, 40)}`);
  });
  const linear = createLinearAdapter({ apiKey: 'k', fetchImpl });
  const ticket = { id: 'uuid-1', team: { id: 't1', key: 'SLO' }, states: [{ id: 's2', name: 'In Progress' }], teamLabels: [{ id: 'l1', name: 'gate-passed' }] };
  const brief = { comment: 'the decision', actions: { label: 'gate-passed', state: 'In Progress' } };
  const applied = await linear.applyBrief(ticket, brief);
  assert.equal(applied.label, 'gate-passed');
  assert.equal(applied.state, 'In Progress');
  const update = calls.find((call) => call.query.includes('issueUpdate'));
  assert.deepEqual(update.variables.input, { addedLabelIds: ['l1'], stateId: 's2' });
  const comment = calls.find((call) => call.query.includes('commentCreate'));
  assert.equal(comment.variables.input.issueId, 'uuid-1');
  assert.equal(comment.variables.input.body, 'the decision');
});

test('the linear adapter creates the label when it is missing', async () => {
  const { fetchImpl, calls } = mockFetch((body) => {
    if (body.query.includes('issueLabelCreate')) return { issueLabelCreate: { success: true, issueLabel: { id: 'l9', name: 'gate-review' } } };
    if (body.query.includes('issueUpdate')) return { issueUpdate: { success: true, issue: { id: 'uuid-1' } } };
    if (body.query.includes('commentCreate')) return { commentCreate: { success: true, comment: { id: 'c1', url: 'u' } } };
    throw new Error('unexpected');
  });
  const linear = createLinearAdapter({ apiKey: 'k', fetchImpl });
  const ticket = { id: 'uuid-1', team: { id: 't1', key: 'SLO' }, states: [], teamLabels: [] };
  const applied = await linear.applyBrief(ticket, { comment: 'x', actions: { label: 'gate-review', state: null } });
  assert.equal(applied.label, 'gate-review');
  const create = calls.find((call) => call.query.includes('issueLabelCreate'));
  assert.equal(create.variables.input.teamId, 't1');
  const update = calls.find((call) => call.query.includes('issueUpdate'));
  assert.deepEqual(update.variables.input, { addedLabelIds: ['l9'] });
});

test('the linear adapter fails loudly on an unknown state', async () => {
  const { fetchImpl } = mockFetch(() => ({ issueUpdate: { success: true } }));
  const linear = createLinearAdapter({ apiKey: 'k', fetchImpl });
  const ticket = { id: 'uuid-1', team: { id: 't1', key: 'SLO' }, states: [{ id: 's2', name: 'Todo' }], teamLabels: [{ id: 'l1', name: 'gate-passed' }] };
  await assert.rejects(() => linear.applyBrief(ticket, { comment: 'x', actions: { label: 'gate-passed', state: 'In Progress' } }), /state "In Progress" not found/);
});

test('the linear adapter attaches a pull-request link', async () => {
  const { fetchImpl, calls } = mockFetch(() => ({ attachmentCreate: { success: true, attachment: { id: 'a1', url: 'https://github.com/x/pull/1' } } }));
  const linear = createLinearAdapter({ apiKey: 'k', fetchImpl });
  const attachment = await linear.attachLink({ id: 'uuid-1' }, { url: 'https://github.com/x/pull/1', title: 'PR' });
  assert.equal(attachment.id, 'a1');
  assert.deepEqual(calls[0].variables.input, { issueId: 'uuid-1', title: 'PR', url: 'https://github.com/x/pull/1' });
});

test('the linear adapter reports a non-OK HTTP response', async () => {
  const fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({}) });
  const linear = createLinearAdapter({ apiKey: 'k', fetchImpl });
  await assert.rejects(() => linear.getTicket('x'), /HTTP 401/);
});

test('the linear adapter clears the policy labels it is not applying', async () => {
  const { fetchImpl, calls } = mockFetch((body) => {
    if (body.query.includes('issueUpdate')) return { issueUpdate: { success: true, issue: { id: 'uuid-1' } } };
    if (body.query.includes('commentCreate')) return { commentCreate: { success: true, comment: { id: 'c1', url: 'u' } } };
    throw new Error('unexpected');
  });
  const linear = createLinearAdapter({ apiKey: 'k', fetchImpl });
  const ticket = { id: 'uuid-1', identifier: 'SLO-1', team: { id: 't1', key: 'SLO' }, states: [], labels: ['gate-review'], teamLabels: [{ id: 'l1', name: 'gate-passed' }, { id: 'l2', name: 'gate-review' }, { id: 'l3', name: 'gate-needs-context' }] };
  const brief = { comment: 'x', actions: { label: 'gate-passed', state: null, removeLabels: ['gate-review', 'gate-needs-context'] } };
  const applied = await linear.applyBrief(ticket, brief);
  const update = calls.find((call) => call.query.includes('issueUpdate'));
  // Only the label the ticket actually carries is removed.
  assert.deepEqual(update.variables.input, { addedLabelIds: ['l1'], removedLabelIds: ['l2'] });
  assert.deepEqual(applied.removed, ['gate-review']);
});

test('the linear adapter removes nothing when the ticket has no conflicting label', async () => {
  const { fetchImpl, calls } = mockFetch((body) => {
    if (body.query.includes('issueUpdate')) return { issueUpdate: { success: true, issue: { id: 'uuid-1' } } };
    if (body.query.includes('commentCreate')) return { commentCreate: { success: true, comment: { id: 'c1', url: 'u' } } };
    throw new Error('unexpected');
  });
  const linear = createLinearAdapter({ apiKey: 'k', fetchImpl });
  const ticket = { id: 'uuid-1', identifier: 'SLO-1', team: { id: 't1', key: 'SLO' }, states: [], labels: [], teamLabels: [{ id: 'l1', name: 'gate-passed' }, { id: 'l2', name: 'gate-review' }] };
  const applied = await linear.applyBrief(ticket, { comment: 'x', actions: { label: 'gate-passed', state: null, removeLabels: ['gate-review'] } });
  const update = calls.find((call) => call.query.includes('issueUpdate'));
  assert.deepEqual(update.variables.input, { addedLabelIds: ['l1'] });
  assert.deepEqual(applied.removed, []);
});

test('the linear adapter matches a label case-insensitively and does not create a duplicate', async () => {
  const { fetchImpl, calls } = mockFetch((body) => {
    if (body.query.includes('issueLabelCreate')) throw new Error('should not create a label');
    if (body.query.includes('issueUpdate')) return { issueUpdate: { success: true, issue: { id: 'uuid-1' } } };
    if (body.query.includes('commentCreate')) return { commentCreate: { success: true, comment: { id: 'c1', url: 'u' } } };
    throw new Error('unexpected');
  });
  const linear = createLinearAdapter({ apiKey: 'k', fetchImpl });
  const ticket = { id: 'uuid-1', identifier: 'SLO-1', team: { id: 't1', key: 'SLO' }, states: [], teamLabels: [{ id: 'l1', name: 'Gate-Passed' }] };
  const applied = await linear.applyBrief(ticket, { comment: 'x', actions: { label: 'gate-passed', state: null } });
  assert.equal(applied.label, 'Gate-Passed');
  assert.equal(calls.some((call) => call.query.includes('issueLabelCreate')), false);
});

test('the linear adapter fails loudly when the update is not applied', async () => {
  const { fetchImpl } = mockFetch((body) => {
    if (body.query.includes('issueUpdate')) return { issueUpdate: { success: false, issue: null } };
    throw new Error('unexpected');
  });
  const linear = createLinearAdapter({ apiKey: 'k', fetchImpl });
  const ticket = { id: 'uuid-1', identifier: 'SLO-1', team: { id: 't1', key: 'SLO' }, states: [], teamLabels: [{ id: 'l1', name: 'gate-passed' }] };
  await assert.rejects(() => linear.applyBrief(ticket, { comment: 'x', actions: { label: 'gate-passed', state: null } }), /did not apply/);
});

test('the linear adapter fails loudly when the label cannot be created', async () => {
  const { fetchImpl } = mockFetch(() => ({ issueLabelCreate: { success: false, issueLabel: null } }));
  const linear = createLinearAdapter({ apiKey: 'k', fetchImpl });
  const ticket = { id: 'uuid-1', identifier: 'SLO-1', team: { id: 't1', key: 'SLO' }, states: [], teamLabels: [] };
  await assert.rejects(() => linear.applyBrief(ticket, { comment: 'x', actions: { label: 'gate-new', state: null } }), /could not create label/);
});

test('the linear adapter fails loudly when the comment is not posted', async () => {
  const { fetchImpl } = mockFetch((body) => {
    if (body.query.includes('issueUpdate')) return { issueUpdate: { success: true, issue: { id: 'uuid-1' } } };
    if (body.query.includes('commentCreate')) return { commentCreate: { success: false, comment: null } };
    throw new Error('unexpected');
  });
  const linear = createLinearAdapter({ apiKey: 'k', fetchImpl });
  const ticket = { id: 'uuid-1', identifier: 'SLO-1', team: { id: 't1', key: 'SLO' }, states: [], teamLabels: [{ id: 'l1', name: 'gate-passed' }] };
  await assert.rejects(() => linear.applyBrief(ticket, { comment: 'x', actions: { label: 'gate-passed', state: null } }), /did not post the comment/);
});

test('the linear adapter fails loudly when the attachment is not created', async () => {
  const { fetchImpl } = mockFetch(() => ({ attachmentCreate: { success: false, attachment: null } }));
  const linear = createLinearAdapter({ apiKey: 'k', fetchImpl });
  await assert.rejects(() => linear.attachLink({ id: 'uuid-1' }, { url: 'u', title: 't' }), /could not attach/);
});
