// The gate pipeline, in order.
//
// 1. Deterministic checks first: prose style and spelling (Vale), template and
//    page-shape conformance, schemas, links. Ordinary code, no model.
// 2. Decision gates second: the narrow semantic criteria a linter cannot settle.
//
// A failed deterministic check blocks the workflow, so the model is never
// asked to judge something a linter already decided. This is CM-009 before
// CM-010, and it is the difference between a gate and a guess.

import { runGates } from './gate.mjs';
import { runChecks } from './checks.mjs';
import { claimGrounded } from './gates/claim-grounded.mjs';

export const verifyCascade = [claimGrounded];

// Run the verification gates over a state (for example { draft, source }).
export async function runCascade(provider, state, gates = verifyCascade) {
  return runGates(gates, provider, state);
}

// Run deterministic checks, then (only if they pass) the gates.
export async function runPipeline(provider, state, { checks = [], gates = verifyCascade } = {}) {
  const checked = runChecks(checks, state);
  if (checked.route !== 'pass') {
    return { route: checked.route, blockedBy: 'deterministic', checks: checked.results, results: [] };
  }
  const gated = await runGates(gates, provider, state);
  return { route: gated.route, checks: checked.results, results: gated.results };
}
