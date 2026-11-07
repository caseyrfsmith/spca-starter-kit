// The operator view: a readable queue, not raw JSON.
//
// An operator reads a list, not a probability distribution: what needs
// attention, why, and what to do next. This module turns gate results (and
// their diagnoses) into that list.

const ACTION_ROUTES = ['escalate', 'stop', 'revise', 'review'];

const SEVERITY = { escalate: 0, stop: 1, revise: 2, review: 3, pass: 4 };

function header(item) {
  const where = item.title ? `${item.id}  ${item.title}` : item.id;
  return `  ${String(item.result.route).padEnd(9)} ${where}`;
}

function details(item) {
  const lines = [];
  if (item.result.reason) lines.push(`             ${item.result.reason}`);
  const diagnosis = item.result.diagnosis;
  if (diagnosis) {
    lines.push(`             diagnosis: ${diagnosis.summary}`);
    if (diagnosis.vague.length) lines.push(`               vague: ${diagnosis.vague.join('; ')}`);
    if (diagnosis.missing.length) lines.push(`               missing: ${diagnosis.missing.join('; ')}`);
    if (diagnosis.suggested.length) lines.push(`               suggested: ${diagnosis.suggested.join('; ')}`);
  }
  return lines;
}

export function formatQueue(items, { gate, provider } = {}) {
  const lines = [`Decision-gates queue  ·  gate \`${gate ?? '?'}\`  ·  provider ${provider ?? '?'}`, ''];
  const action = items.filter((item) => ACTION_ROUTES.includes(item.result.route))
    .sort((a, b) => SEVERITY[a.result.route] - SEVERITY[b.result.route]);
  const clear = items.filter((item) => item.result.route === 'pass');

  if (action.length) {
    lines.push(`ACTION NEEDED (${action.length})`);
    for (const item of action) lines.push(header(item), ...details(item));
    lines.push('');
  }
  if (clear.length) {
    lines.push(`CLEAR (${clear.length})`);
    for (const item of clear) lines.push(header(item));
    lines.push('');
  }

  const counts = new Map();
  for (const item of items) counts.set(item.result.route, (counts.get(item.result.route) ?? 0) + 1);
  const summary = [...counts.entries()].map(([route, n]) => `${n} ${route}`).join('  ·  ');
  lines.push(`${items.length} ${items.length === 1 ? 'ticket' : 'tickets'}  ·  ${summary}`);
  return lines.join('\n');
}
