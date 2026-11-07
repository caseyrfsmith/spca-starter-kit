#!/usr/bin/env node
// Live smoke test for the Linear adapter — the one path the offline tests
// cannot cover. It talks to the real Linear GraphQL API and is skipped unless
// LINEAR_API_KEY is set.
//
//   LINEAR_API_KEY=... node bin/live-linear.mjs --issue SLO-123
//   LINEAR_API_KEY=... node bin/live-linear.mjs --issue SLO-123 --apply
//
// Without --apply it is read-only: it proves authentication and the query shape
// against a real workspace. With --apply it performs the operator loop's
// write-back against that issue (resolve/create the policy label, move the
// state, post the comment, attach a test link). Point --apply at a scratch
// ticket, never production.
//
// To get a key: Linear > Settings > Security & access > Personal API keys.
// The MCP server is a separate, OAuth-based path and does not provide one.

import { createLinearAdapter } from '../src/adapters/linear.mjs';
import { planBrief, policyForGate } from '../src/operator.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 1) {
  if (process.argv[i] === '--apply') args.apply = true;
  else if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[i + 1];
}

const apiKey = process.env.LINEAR_API_KEY;
if (!apiKey) {
  console.error('LINEAR_API_KEY is not set. This live test is skipped; the offline mock tests still cover the request shapes.');
  process.exit(2);
}
if (!args.issue) {
  console.error('Usage: LINEAR_API_KEY=... node bin/live-linear.mjs --issue <SLO-123> [--apply]');
  process.exit(2);
}

try {
  const linear = createLinearAdapter({ apiKey });

  const ticket = await linear.getTicket(args.issue);
  console.log(`read ${ticket.identifier}: "${ticket.title}"`);
  console.log(`  state  ${ticket.state?.name ?? '(none)'}`);
  console.log(`  labels ${ticket.labels.join(', ') || '(none)'}`);
  console.log(`  team   ${ticket.team.key} (${ticket.team.id})`);
  console.log(`  states ${ticket.states.map((state) => state.name).join(', ')}`);

  if (!args.apply) {
    console.log('\nread-only: pass --apply to exercise the write-back against this issue.');
    process.exit(0);
  }

  // Build the brief through the real planner, so the live run exercises exactly
  // what the operator loop would send — including the label-clearing.
  const brief = planBrief({
    id: ticket.identifier,
    ticket: { title: ticket.title },
    policy: policyForGate(args.gate ?? 'testable-criteria'),
    result: {
      gate: args.gate ?? 'testable-criteria',
      provider: 'live-smoke-test',
      route: 'pass',
      choice: 'observable',
      reason: 'live smoke test of the adapter; this brief makes no real decision',
    },
  });
  console.log(`\napplying pass brief: label "${brief.actions.label}", state "${brief.actions.state}", clearing ${brief.actions.removeLabels.length} other decision label(s), a comment, and a test link`);
  const applied = await linear.applyBrief(ticket, brief);
  const removed = applied.removed.length ? ` · removed ${applied.removed.join(', ')}` : '';
  console.log(`  applied label "${applied.label}"${applied.state ? ` and state "${applied.state}"` : ''}${removed} · comment ${applied.commentUrl ?? '(no url)'}`);

  const attachment = await linear.attachLink(ticket, { url: 'https://example.com/decision-gates-smoke', title: 'Smoke-test link' });
  console.log(`  attached ${attachment.url ?? attachment.id}`);

  const after = await linear.getTicket(args.issue);
  console.log(`\nread back: state ${after.state?.name ?? '(none)'} · labels ${after.labels.join(', ') || '(none)'}`);
  console.log('live write-back verified.');
} catch (error) {
  console.error(`live test failed: ${error.message}`);
  process.exit(1);
}
