# Decision gates (starter kit)

A small, runnable example of **CM-010 Probabilistic Quality Gates** and
**TG-006 Chained Decision-Model Workflow**: typed decisions that route a
documentation workflow, with an explicit policy in ordinary code. It is the
working companion to the website's
[Reflex Arc](https://slopcontrol.org/experimental-defenses/reflex-arc) concept.

A decision gate asks one narrow question and returns a typed answer — a choice
from a fixed set, or the probability that a stated proposition holds. The answer
selects a route. The model never writes prose, so there is nothing to parse and
nothing to hallucinate.

Requires Node.js 22.12 or later. No dependencies are installed.

## What is here

| Path | Purpose |
| --- | --- |
| `src/provider.mjs` | The providers: `stub`, `openai`, `decisions`. |
| `src/routing.mjs` | The route vocabulary and the band/combination helpers. |
| `src/gate.mjs` | The generic runner, the cascade combiner and the accuracy counter. |
| `src/gates/` | The gates themselves; `index.mjs` is the registry. |
| `src/pipeline.mjs` | The verified cascade, and the deterministic-then-gates ordering. |
| `src/checks.mjs` | The deterministic checks that run before any gate. |
| `src/worker.mjs` | The diagnoser: turns a non-pass verdict into specific feedback. |
| `src/escalate.mjs` | The escalation path: decide, then diagnose. |
| `bin/gate.mjs` | Run one gate; `--list` shows them. |
| `bin/pipeline.mjs` | Run the verification gates over a draft. |
| `bin/calibrate.mjs` | Score a gate against its labeled dataset. |
| `bin/check.mjs` | Run the deterministic checks over a file (offline). |
| `bin/escalate.mjs` | Run a gate and diagnose a non-pass verdict. |
| `src/operator.mjs` | The operator brief: route to label, state and pull-request plan. |
| `src/adapters/` | Optional side effects: `git` (branch and PR) and `linear` (write-back). |
| `bin/operator.mjs` | The operator loop: decide a ticket, then apply the brief. |
| `data/*.jsonl` | One labeled dataset per gate. |
| `TUNING.md` | How to tune a gate: the question first, then the policy. |
| `OPERATOR.md` | The operator loop: the brief, the policy and the adapters. |
| `test/` | Offline tests. No network, no key. |

## Quick start

```sh
node bin/gate.mjs --list
node bin/gate.mjs --ticket tickets/example-ticket.json   # offline demo (stub)
node --test
```

The default provider is a `stub` that returns fixed answers, clearly labeled in
the output. It proves the wiring, not the decision.

## Deterministic checks run first

Decision gates are the semantic layer, not the first layer. Prose style and
spelling (**Vale**), template and page-shape conformance, schemas, links and
exact values are deterministic and belong in ordinary code **before** any model
is asked. A deterministic failure blocks the workflow, so the model is never
asked to judge what a linter already decided.

This kit does not reimplement those tools — it ships the same Vale and doc-shape
material as the rest of the Starter Kit (`vale/`, `examples/tactical/.vale.ini`,
`vale/docshape.ini`; see CM-003, CM-009 and TG-002). It includes a tiny built-in
shape check only so the ordering can be run and tested without them:

```sh
node bin/check.mjs path/to/page.md --require Summary --require Limitations
```

`src/pipeline.mjs` runs the deterministic checks first and calls the gates only
when they pass (`runPipeline`). A failed check returns immediately with
`blockedBy: "deterministic"` and an empty gate list.

## The gates

| Gate | Question | Routes |
| --- | --- | --- |
| `testable-criteria` | What best describes the acceptance criteria? | `observable` → pass, `vague`/`absent` → revise, `deferred` → escalate |
| `docs-needed` | Does this change require a documentation change? | `required` → pass, `not_required` → stop, `unclear` → escalate |
| `claim-grounded` | How does the draft relate to its source? | `supported` → pass, `unsupported` → revise, `missing` → escalate |
| `answerable` | Can this question be answered from the context? | high confidence → pass, otherwise escalate |

`testable-criteria`, `docs-needed` and `claim-grounded` are reason-based Choices.
`answerable` is a Noul — a single clear proposition, where the probability itself
carries the uncertainty. It is binary by default (pass or escalate); set
`reviseAt` in its policy to add a revise band via `routeBand`, so a clearly
unrelated context goes back to the author instead of to a person.

Each gate lives in `src/gates/<id>.mjs` and is registered in
`src/gates/index.mjs`.

## Routing

Routes follow CM-010's policy: **pass, revise, escalate, stop**, ordered by
severity. `combine` returns the most severe, so a failed required check is never
averaged away by unrelated passes. A low-confidence pass or revise becomes an
escalate (`reviewBelow`), so nothing uncertain is auto-actioned.

## Providers (bring your own key)

Live providers read `OPENROUTER_API_KEY` from the environment and never write it
to disk. Note the data egress: the provider receives the whole `state` — that is,
the ticket or draft text — so whatever you gate leaves your machine and reaches
the endpoint you configure. Do not gate material you are not permitted to send
there. Two request shapes are included:

```sh
# A Decisions API that returns typed answers directly (TypeSafe Jev and similar)
OPENROUTER_API_KEY=... node bin/gate.mjs \
  --gate testable-criteria --ticket tickets/example-ticket.json \
  --provider decisions --model typesafe/jev-1.14

# Any OpenAI-shaped chat endpoint
OPENROUTER_API_KEY=... node bin/gate.mjs \
  --gate claim-grounded --state draft.json \
  --provider openai --model openai/gpt-4o-mini
```

`--ticket` wraps the file as `{ "ticket": ... }`; `--state` passes the file as
the whole state object (for gates that read other keys). The `decisions`
provider returns typed answers, so there is nothing to parse. The `openai`
provider must be *asked* for JSON, and the reply is validated against the
allowed shapes, so a malformed or off-menu answer is a failed check, not a pass.

## The verified cascade

```sh
OPENROUTER_API_KEY=... node bin/pipeline.mjs --state draft.json --provider decisions --model typesafe/jev-1.14
```

`src/pipeline.mjs` runs the verification gates over a state (for example
`{ "draft": ..., "source": ... }`) and combines their routes. Add a gate to
`verifyCascade` to check more. This is the "draft with a model, verify with
gates" pattern: the working model produces language, the gates decide whether it
may proceed.

## The escalation path (the diagnoser)

A gate decides; when it does not pass, the **diagnoser** explains why. It is an
LLM worker that produces specific, testable feedback — what is vague, what is
missing, what to add — while the gate's route stands. The worker never
re-decides.

```sh
# offline demo: a fixed decision and a fixed diagnosis
node bin/escalate.mjs --gate testable-criteria --ticket tickets/example-ticket.json

# live: Jev decides, an LLM diagnoses
OPENROUTER_API_KEY=... node bin/escalate.mjs \
  --gate testable-criteria --ticket t.json \
  --provider decisions --model typesafe/jev-1.14 \
  --worker openai --worker-model openai/gpt-4o-mini
```

The diagnoser runs on `revise` and `escalate` by default — the routes where
feedback helps; `stop` is terminal and is not diagnosed. The route in the output
is always the gate's. This is the
"route-then-write" pattern: the gate routes, the worker writes. That is why a
`revise` verdict comes back with the exact phrase to fix, and an `escalate`
verdict with the material that is missing.

The result also carries a **`comment`**: the diagnosis rendered as Markdown,
ready to post back to the ticket. Print just that with `--comment-only`:

```sh
node bin/escalate.mjs --gate testable-criteria --ticket ticket.json --comment-only
```

The kit does not post the comment; the surrounding agent or workflow does. The
gate stays authoritative throughout — the comment explains a decision, it does
not make one.

## The operator loop

The gates decide; the **operator loop** turns the decision into the label, the
state, the comment and the pull request. `bin/operator.mjs` prints a **brief**
and, when you ask it to, applies it:

```sh
# Decide a ticket (offline with the stub).
node bin/operator.mjs plan --ticket work/tickets/slo-10.json

# Decide, write back to the tracker, and open a pull request.
node bin/operator.mjs run --ticket work/tickets/slo-10.json --ticket-id SLO-10 \
  --tracker linear --pr --repo ../.. --branch slo-10 \
  --paths content/a.mdx --pr-title "Publish the pages"
```

`plan` writes nothing. `run` writes only when `--tracker` and `--pr` are given,
and it opens a pull request only when the route authorizes one — a `revise`
verdict refuses the PR rather than opening one the gate did not approve. Add
`--dry-run` to print every step without running it. [OPERATOR.md](OPERATOR.md)
covers the policy, the adapters and the keys.

## Calibrate

The routes and thresholds are **placeholders**. Do not adopt them. Score a gate
against its labeled dataset and read the two error types separately:

```sh
OPENROUTER_API_KEY=... node bin/calibrate.mjs --gate docs-needed --provider decisions --model typesafe/jev-1.14
```

`falseApprovals` are bad artifacts allowed through; `falseRejections` are good
artifacts blocked. They rarely cost the same, so choose routes and thresholds
that keep the one you can least afford near zero. Re-run calibration when the
model, the question or the input distribution changes.

**[TUNING.md](TUNING.md)** is the full guide: fix the question before the bands,
build a labeled dataset, read the errors, set the confidence band, and know when
to re-tune.

## Add your own gate

1. Copy `src/gates/claim-grounded.mjs` as a template.
2. Write the question (a `choice` with a `criteria` map, or a `noul` proposition)
   and a `decide(answers)` that returns a route. Keep one clear interpretation
   and a known answer space; avoid "is this good?".
3. Register it in `src/gates/index.mjs`.
4. Add a labeled dataset at `data/<id>.jsonl` (rows of `{ id, expected, state }`).
5. Run `node --test` and then `bin/calibrate.mjs` with a live provider.

Keep deterministic checks — schemas, links, exact values — in ordinary code
before any semantic gate (CM-009). A model judgment supports a scoped decision;
it does not prove facts or authorize actions.

## Using a ticket tracker (Linear, by MCP)

This kit deliberately contains no tracker client. In an agent session that has a
**Linear MCP server** configured, the agent fetches the ticket and pipes it in:

1. Read the ticket through the tracker's MCP server (title, description,
   acceptance criteria).
2. Write those fields to a JSON file in the shape of
   `tickets/example-ticket.json`.
3. Run `node bin/gate.mjs --gate testable-criteria --ticket that-file.json --provider decisions`.
4. Act on the route — pass, return to the author to revise, send to a person, or
   stop — and write the result back (a label or a comment) so the decision lives
   where the work lives.

The same loop can also run without an agent. `bin/operator.mjs run --tracker
linear` reads the ticket and writes the label, state and comment back through
the Linear API, and `--pr` opens the pull request. That adapter is optional and
off by default; [OPERATOR.md](OPERATOR.md) records what it does and its current
limitations.

The tracker connection lives in the agent, not here. Keep the retrieved ticket
and the model's answers as a record, and never commit a key.

## Limitations

- A probability is not a verdict. A gate supports a scoped decision; it does not
  prove the work is worthwhile or that it should exist.
- A model's confidence is not a calibrated probability until you measure it on
  your own examples.
- The stub proves wiring only. Do not read its verdict as a judgement.
- Several questions from one model, or from similar models, can share a failure
  mode. Inspect the results.
- Deterministic conditions belong in ordinary code and should run before a gate.
- Human review remains necessary for disputed criteria and consequential actions.
- The Linear adapter's GraphQL is exercised against a mock in the tests, not a
  live workspace. Verify the request shapes and the label and state names
  against your own account before relying on the write-back.
