// Shared routing vocabulary.
//
// Routes follow CM-010's policy: pass, revise, escalate, stop. They are ordered
// by severity so several gate results can be combined without hiding a failure.

export const ROUTES = ['pass', 'revise', 'escalate', 'stop'];

export function severity(route) {
  const index = ROUTES.indexOf(route);
  if (index < 0) throw new Error(`unknown route "${route}"`);
  return index;
}

// Combine several routes: the most severe wins. A failed required check is
// never averaged away by unrelated passes.
export function combine(routes) {
  return routes.reduce((worst, route) => (severity(route) > severity(worst) ? route : worst), 'pass');
}

// An unsure pass or revise becomes an escalate, so nothing uncertain is
// auto-actioned. stop and escalate pass through unchanged.
export function withConfidence(route, confidence, reviewBelow) {
  if (reviewBelow === undefined) return route;
  if ((route === 'pass' || route === 'revise') && (confidence ?? 1) < reviewBelow) return 'escalate';
  return route;
}

// Route a Choice answer through a map of choice -> route, applying the review
// band to passes and revises.
export function routeChoice(answer, routes, reviewBelow) {
  const route = routes[answer.choice];
  if (route === undefined) throw new Error(`no route for "${answer.choice}"`);
  return withConfidence(route, answer.confidence, reviewBelow);
}

// Route a probability through ordered bands. The middle band is always
// escalate: a probability near the boundary is an unresolved judgment.
export function routeBand(probability, { passAt, reviseAt }) {
  if (probability >= passAt) return 'pass';
  if (probability <= reviseAt) return 'revise';
  return 'escalate';
}
