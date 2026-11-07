// The generic gate runner.
//
// A gate is data: an id, a set of typed questions, and a `decide` policy that
// turns typed answers into a route. The provider answers the questions; the
// gate's policy routes the result. No gate needs to know about a provider, and
// no provider needs to know about a gate.

import { combine, ROUTES } from './routing.mjs';

export async function runGate(gate, provider, state) {
  const answers = await provider.ask({ state, questions: gate.questions });
  const decision = gate.decide(answers);
  return {
    gate: gate.id,
    version: gate.version,
    summary: gate.summary,
    provider: provider.name,
    model: provider.model ?? null,
    answers,
    ...decision,
  };
}

// Run several gates over the same state and combine their routes. This is the
// verified cascade: a draft passes only if every required gate passes.
export async function runGates(gates, provider, state) {
  const results = [];
  for (const gate of gates) results.push(await runGate(gate, provider, state));
  return { route: combine(results.map((result) => result.route)), results };
}

// Compare gate results with expected routes. `rows` is [{id, expected, result}].
// False approvals (a bad artifact allowed through) and false rejections (a good
// artifact blocked) are counted separately because they usually cost different
// amounts.
export function evaluate(rows) {
  let correct = 0;
  let falseApprovals = 0;
  let falseRejections = 0;
  const details = [];
  for (const row of rows) {
    const got = row.result.route;
    const expected = row.expected;
    if (!ROUTES.includes(expected)) throw new Error(`unknown expected route "${expected}" for ${row.id}`);
    if (got === expected) correct += 1;
    // A false approval is a bad artifact let through; a false rejection is a
    // good artifact blocked. "Blocked" covers every non-pass route, so a good
    // artifact sent to escalate or stop counts too and never vanishes from the
    // numbers the thresholds are chosen from.
    if (got === 'pass' && expected !== 'pass') falseApprovals += 1;
    if (expected === 'pass' && got !== 'pass') falseRejections += 1;
    details.push({ id: row.id, expected, got, decision: row.result.choice ?? row.result.probability ?? null });
  }
  return { total: rows.length, correct, falseApprovals, falseRejections, details };
}
