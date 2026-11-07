// The operator brief: the plan between a gate's decision and the actions a
// person (or an agent acting as one) applies.
//
// The gate decides the route. This module turns that route, and any diagnosis,
// into a small, explicit plan: which label to apply, which state to move the
// ticket to, whether the route authorizes a pull request, and the comment to
// post back. It is ordinary code — the same result always produces the same
// plan — so the loop can be run without a person making the routing call.
//
// It performs no I/O. The adapters (`src/adapters/`) carry the plan to a
// tracker and a repository; this file only decides what the plan is.

import { ROUTES } from './routing.mjs';

// The default policy maps each route to the action it authorizes. Override it
// to match your tracker's labels and states. The kit's tests check that every
// route has an entry, so a new route cannot slip through unrouted.
//
//   disposition      what the operator does: proceed, revise, review, stop, drop.
//   label            the decision label to apply (the brief also clears the
//                    policy's other labels, so a ticket never carries two).
//   state            the tracker state to move the ticket to, or null to leave it.
//   openPullRequest  whether the route authorizes opening a pull request.
export const defaultPolicy = {
  pass: { disposition: 'proceed', label: 'gate-passed', state: 'In Progress', openPullRequest: true },
  revise: { disposition: 'revise', label: 'gate-needs-criteria', state: null, openPullRequest: false },
  escalate: { disposition: 'review', label: 'gate-needs-context', state: null, openPullRequest: false },
  stop: { disposition: 'stop', label: 'gate-review', state: null, openPullRequest: false },
};

// Per-gate overrides. A single label per route cannot be right for every gate,
// and `stop` is the sharpest case: in the pipeline it means "halt", but for
// `docs-needed` it is the benign "no documentation work" outcome, not "send it
// to a person". That gate gets its own stop action.
export const gatePolicies = {
  'docs-needed': {
    ...defaultPolicy,
    stop: { disposition: 'drop', label: 'gate-not-needed', state: null, openPullRequest: false },
  },
};

export function policyForGate(gateId) {
  return gatePolicies[gateId] ?? defaultPolicy;
}

const NEXT = {
  proceed: 'Continue to a pull request; a person still signs off.',
  revise: 'Return to the author with the diagnosis.',
  review: 'Send to a person with the diagnosis.',
  stop: 'Stop; do not proceed without a person.',
  drop: 'No documentation work required; nothing to do.',
};

function two(value) {
  return Number(value).toFixed(2);
}

// One line of machine-readable evidence, so the decision can be audited later.
function metricsLine(result) {
  const bits = [];
  if (result.choice != null) bits.push(`choice: ${result.choice}`);
  if (result.probability != null) bits.push(`probability: ${two(result.probability)}`);
  if (result.confidence != null) bits.push(`confidence: ${two(result.confidence)}`);
  if (result.model != null) bits.push(`model: ${result.model}`);
  if (result.gate != null) bits.push(`gate: ${result.gate}${result.version != null ? ` v${result.version}` : ''}`);
  return bits.join(' · ');
}

// Render the decision as a Markdown comment, ready to post back to the ticket.
// The gate's route leads, the evidence follows, and the review caveat closes.
export function formatComment(result = {}) {
  const lines = [`**Decision gate \`${result.gate}\`: route \`${result.route}\`**`];
  if (result.reason) lines.push('', result.reason);
  const metrics = metricsLine(result);
  if (metrics) lines.push('', `\`${metrics}\``);
  if (result.route === 'pass') {
    lines.push('', 'The gate is not a substitute for review. The route keeps the work moving; a person still signs off.');
  }
  return lines.join('\n');
}

// Every label the policy can apply, minus the chosen one. Applying these as
// removals keeps a ticket from carrying two contradictory decision labels.
function labelsToClear(policy, chosen) {
  const labels = new Set();
  for (const entry of Object.values(policy)) {
    if (entry.label && entry.label !== chosen) labels.add(entry.label);
  }
  return [...labels];
}

// Turn a gate result into the operator brief. This is the whole decision
// surface: the route selects the policy entry, and the policy names the action.
export function planBrief({ id, ticket = {}, result, policy = defaultPolicy } = {}) {
  if (!result || !result.route) throw new Error('planBrief needs a gate result with a route');
  const action = policy[result.route];
  if (!action) throw new Error(`no operator policy for route "${result.route}"`);
  const label = action.label ?? null;
  const title = ticket.title ?? result.title ?? null;
  return {
    id: id ?? null,
    title,
    gate: result.gate,
    gateVersion: result.version,
    provider: result.provider ?? null,
    model: result.model ?? null,
    route: result.route,
    choice: result.choice ?? null,
    probability: result.probability ?? null,
    confidence: result.confidence ?? null,
    reason: result.reason ?? null,
    diagnosis: result.diagnosis ?? null,
    disposition: action.disposition,
    comment: result.comment ?? formatComment(result),
    actions: {
      label,
      state: action.state,
      openPullRequest: action.openPullRequest,
      removeLabels: labelsToClear(policy, label),
    },
    next: NEXT[action.disposition] ?? null,
  };
}

// Whether a brief authorizes a pull request. The CLI refuses to open one when
// it does not, so the route genuinely gates the repository side effect.
export function canOpenPullRequest(brief) {
  return Boolean(brief?.actions?.openPullRequest);
}

// The operator view: one decision, one action, and the next step.
export function formatBrief(brief) {
  const where = [brief.id, brief.title].filter(Boolean).join('  ');
  const lines = [where || '(ticket)'];
  lines.push(`  route        ${brief.route}  →  ${brief.disposition}`);
  const source = [brief.provider, brief.model].filter(Boolean).join(' / ');
  lines.push(`  gate         ${brief.gate}${brief.gateVersion != null ? ` v${brief.gateVersion}` : ''}${source ? `  (${source})` : ''}`);
  if (brief.choice != null) lines.push(`  choice       ${brief.choice}${brief.confidence != null ? `  (confidence ${two(brief.confidence)})` : ''}`);
  if (brief.probability != null) lines.push(`  probability  ${two(brief.probability)}`);
  if (brief.reason) lines.push(`  reason       ${brief.reason}`);
  if (brief.diagnosis) lines.push(`  diagnosis    ${brief.diagnosis.summary}`);
  const state = brief.actions.state ?? '(leave unchanged)';
  lines.push(`  actions      label: ${brief.actions.label ?? '(none)'}  ·  state: ${state}  ·  pull request: ${brief.actions.openPullRequest ? 'yes' : 'no'}`);
  if (brief.next) lines.push(`  next         ${brief.next}`);
  return lines.join('\n');
}

// Exposed so a future route can be added without silently breaking the loop.
export function policyCoversAllRoutes(policy = defaultPolicy) {
  return ROUTES.every((route) => Boolean(policy[route]));
}
