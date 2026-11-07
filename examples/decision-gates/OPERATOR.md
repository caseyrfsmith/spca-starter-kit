# The operator loop

The gates decide; the **operator loop** turns a decision into the steps a person
— or an agent driving the loop like a mechanism — applies to a ticket. It is the
glue between `bin/escalate.mjs` (which stops at a verdict and a comment) and a
tracker that must be updated and a pull request that must be opened.

Everything the loop does is ordinary, deterministic code. Given the same ticket
and the same answers it prints the same plan, so the routing call is not
re-made by whoever is holding the keyboard.

## Two commands

```sh
# Decide. Offline with the stub; live with a provider.
node bin/operator.mjs plan --ticket work/tickets/slo-10.json

# Decide, then apply: write the label, state and comment back, and open a pull
# request when the route authorizes it.
node bin/operator.mjs run --ticket work/tickets/slo-10.json --ticket-id SLO-10 \
  --tracker linear --pr --repo ../.. \
  --branch slo-10-decision-gates \
  --paths content/decision-gates.mdx --paths content/reflex-arc.mdx \
  --pr-title "Publish the decision gate pages"
```

`plan` never writes anything. `run` writes only when you ask it to: `--tracker`
enables the tracker write-back, `--pr` enables the pull request. Add `--dry-run`
to print every step without performing any of them.

To drive a non-pass route offline, `--demo '<json>'` overrides the stub answers,
for example `--demo '{"failureMode":{"choice":"vague","confidence":0.9}}'` to see
the `revise` brief and the pull-request refusal.

## The brief

The loop's output is a **brief**: the route, the evidence, the diagnosis (when
there is one), the comment to post, and the actions the route authorizes.

```text
SLO-10  Publish the decision gate starter kit and Reflex Arc pages
  route        pass  →  proceed
  gate         testable-criteria v0.3  (decisions / typesafe/jev-1.14)
  choice       observable  (confidence 0.97)
  reason       criteria describe observable outcomes
  actions      label: gate-passed  ·  state: In Progress  ·  pull request: yes
  next         Continue to a pull request; a person still signs off.
```

`--json` prints the same brief as an object, for another tool to consume.

## The policy: route to action

`src/operator.mjs` maps each route to the action it authorizes. This is the only
place the routing decision becomes a side effect.

| Route | Disposition | Label | State | Pull request |
| --- | --- | --- | --- | --- |
| `pass` | proceed | `gate-passed` | In Progress | yes |
| `revise` | revise | `gate-needs-criteria` | — | no |
| `escalate` | review | `gate-needs-context` | — | no |
| `stop` | stop | `gate-review` | — | no |

Change the labels and states to match your tracker. The kit's tests check that
every route in the vocabulary has a policy entry, so a new route cannot be added
without also deciding what it does.

When a brief is applied it also **clears the policy's other labels**, so a ticket
never carries two contradictory decisions (for example `gate-review` and
`gate-passed` at once).

`stop` means "halt the workflow", not "this is bad". Some gates use it for a
benign outcome: `docs-needed` answers `not_required → stop`, so its terminal case
is "no documentation work", not "send it to a person". Per-gate overrides live in
`gatePolicies` in `src/operator.mjs`; `policyForGate('docs-needed')` maps that
`stop` to a `drop` disposition and a `docs-not-needed` label. Add an override the
same way when a route means something different for a gate.

A pull request is opened **only** when the route authorizes it. Running
`run --pr` on a `revise` verdict fails loudly instead of opening a PR that the
gate did not approve.

## Adapters

The loop is provider-neutral and tracker-neutral. The decision path has no
dependencies; the two side effects live in opt-in adapters under
`src/adapters/`.

### `git` — branches and pull requests

`gitPlan(...)` is a pure function: it returns the ordered commands (branch,
add, commit, push, `gh pr create`) without running them, which is what `--dry-run`
prints. The adapter executes the plan with an injected runner and stops at the
first failure, so a failed push never leads to a pull request that points at
nothing.

`gh` uses its own stored authentication. No key is read by this adapter.

### `linear` — tracker write-back

Loaded only with `--tracker linear`. It reads the ticket, resolves (or creates)
the policy label, clears the other decision labels, moves the state, posts the
decision comment, and attaches the pull-request links. It reads `LINEAR_API_KEY`
from the environment and never writes it anywhere.

The request and response shapes are checked against a mock in the offline tests,
and the whole write-back was verified once against a real workspace on
2026-11-07 with `bin/live-linear.mjs`. Re-run that against your own account
before relying on it:

```sh
LINEAR_API_KEY=... node bin/live-linear.mjs --issue <ticket>          # read-only
LINEAR_API_KEY=... node bin/live-linear.mjs --issue <ticket> --apply  # write-back
```

## Keys

| Variable | Used by | Notes |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | the `decisions` and `openai` providers, and the worker | read from the environment, never written to disk |
| `LINEAR_API_KEY` | the Linear adapter | read from the environment, never written to disk |

## The worked example

This loop ran against Linear issue **SLO-10**. The gate returned `pass`
(`observable`, confidence 1.00); the brief authorized a pull request; the loop
applied the `gate-passed` label, moved the issue to In Progress, posted the
decision and the pull-request links as a comment, and opened a PR in each
repository. The website's
[Decision gate starter kit](https://slopcontrol.org/starter-kit/decision-gates)
page shows the resulting ticket and write-back.

That run's write-back was an agent using the Linear MCP server. The adapter path
was verified separately on 2026-11-07: `bin/live-linear.mjs` read SLO-10 (auth,
the query and the label/state resolution) and, with `--apply`, applied the label,
state, comment and an attachment to a scratch ticket, then read them back.

## Boundaries

- The gate authorizes the action; it does not prove the work is good. A person
  still reviews and merges.
- `run` mutates a tracker and a repository. Use `--dry-run` first, and run it on
  a branch — never directly on your default branch.
- The loop is not a scheduler. It runs one ticket per invocation, so an operator
  (or an agent) can see and approve each step.
