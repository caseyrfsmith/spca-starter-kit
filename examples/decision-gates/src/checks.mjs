// Deterministic checks run BEFORE any decision gate.
//
// A prose linter (Vale), a template or page-shape validator, a schema check, a
// link checker: these are ordinary code, and they belong in front of any model.
// Each check returns { name, route, findings } using the same route vocabulary,
// so a failed deterministic check blocks the workflow and no model is called.
//
// The kit does NOT reimplement Vale or your template rules. The real
// configurations ship with the rest of the Starter Kit (`vale/`,
// `examples/tactical/.vale.ini`, `vale/docshape.ini`). The small check below
// exists so the ordering can be run and tested without those tools installed;
// replace it with a call to your linter and shape validator.

import { combine } from './routing.mjs';

function escape(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Example deterministic check: required headings are present and there are no
// unresolved TODO markers. Illustrative only — do not treat it as a linter.
export function docShape({ markdown = '', requiredHeadings = [] } = {}) {
  const findings = [];
  for (const heading of requiredHeadings) {
    if (!new RegExp(`^#{1,6}\\s+${escape(heading)}\\b`, 'm').test(markdown)) {
      findings.push({ rule: 'missing-heading', heading });
    }
  }
  if (/(^|\s)TODO\b/.test(markdown)) findings.push({ rule: 'unresolved-todo' });
  return { name: 'doc-shape', route: findings.length ? 'revise' : 'pass', findings };
}

export function runChecks(checks, input) {
  if (checks.length === 0) return { route: 'pass', results: [] };
  const results = checks.map((check) => check(input));
  return { route: combine(results.map((result) => result.route)), results };
}
