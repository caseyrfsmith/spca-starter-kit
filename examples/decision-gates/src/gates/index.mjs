import { testableCriteria } from './testable-criteria.mjs';
import { docsNeeded } from './docs-needed.mjs';
import { claimGrounded } from './claim-grounded.mjs';
import { answerable } from './answerable.mjs';

// The registry. Add a gate by importing it here; everything else — the CLI,
// calibration, the pipeline — finds it by id.

export const gates = [testableCriteria, docsNeeded, claimGrounded, answerable];

export function getGate(id) {
  const gate = gates.find((candidate) => candidate.id === id);
  if (!gate) throw new Error(`unknown gate "${id}". Known gates: ${gates.map((gate) => gate.id).join(', ')}`);
  return gate;
}

export function listGates() {
  return gates.map((gate) => ({ id: gate.id, version: gate.version, summary: gate.summary }));
}
