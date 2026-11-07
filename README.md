# SPCA Starter Kit

Standalone tools and examples from SPCA, maintained independently of the SPCA website.

**Status: Editorial draft.** Review before adopting; see VERIFICATION.md for tested scope and limitations.

**Purpose:** Templates, prose and page-shape checks, optional agent hooks, decision gates, and tactical-guide examples to adapt to your workflow. Start with the examples index to choose between runnable examples and illustrative snippets. It does **not** connect to Linear or require Shoalrun. The decision-gates example uses a model API only when you supply a provider key and an evaluated dataset, and its optional operator loop writes back to a tracker and opens a pull request only when you pass the flags; the rest of the kit does not use model APIs.

## Use it with an agent

Give your agent the extracted folder and a concrete task. Ask it to read AGENTS.md and examples/README.md first. For example:

> Read this kit's AGENTS.md and examples/README.md. Use the TG-002 example to add Vale checks to our project. Adapt the rules to our content, test passing and failing cases, and report the commands and results.

AGENTS.md maps tasks to the matching examples and checks. You can instead ask for page-shape checks, structured-ticket validation or a review of an optional hook. The folder does not activate agent settings by itself; the agent still needs your goal and the target project.

## Quick start

Requires Python 3.10+ (3.12 recommended). From this directory:

```sh
python3 -m unittest discover -s tests -v
python3 tools/validate.py examples/pass.md
python3 tools/validate.py examples/fail.md  # intentionally exits 1
mkdir -p work
cp templates/linear-ticket.md work/my-ticket.md
# Edit the draft and resolve TODOs
python3 tools/validate.py work/my-ticket.md
```

`work/` is an optional local directory for drafts. The sample validator checks H1 presence, required and optional headings, heading order, TODO markers, a few illustrative filler phrases, and acceptance-criteria checklist shape. It **cannot** determine whether the ticket is useful, accurate, or testable in practice.

## Vale (optional)

If Vale is installed, run from `vale/`:

```sh
vale --config .vale.ini ../examples/pass.md
vale --config .vale.ini ../examples/fail.md
```

The Vale rules are illustrative. Run `python3 tools/check_vale.py` to verify them in the installed Vale runtime; the ordinary Python unit suite does not require Vale. Adjust severities and test them against your corpus. The standard-library validator and Vale 3.24.0 rules were checked locally; see VERIFICATION.md for exact scope and runtime limitations.

## Incident reports

Use [templates/incident-report.md](templates/incident-report.md) to write up a case, following [docs/INCIDENT-REPORTS.md](docs/INCIDENT-REPORTS.md). It is a blank Markdown template, not an executable example or a supplied incident. No runtime is needed.

## Guide examples

Start with [the examples index](examples/README.md). The kit also includes TG-001's optional Node.js parser/mock read-back example, TG-002's exact configured Vale rules and test files, TG-003's Vale hook handler, licensed Shoalrun DocShape rules with recipe fixtures, and copyable code blocks from the other guides/references.

For the TG-002 table, use `examples/tactical/.vale.ini`; for the original Python ticket example, use `vale/.vale.ini`; for structural checks, use `vale/docshape.ini`. `python3 tools/check_vale.py` tests all three configurations. The examples index distinguishes runnable files from illustrative patterns.

## Claude Code (optional)

To get automatic feedback in Claude Code, you need to add and enable the hook yourself. The kit supplies example settings and a script; extracting it does not install the hook.

Review `.claude/settings.example.json` and `.claude/check-ticket-hook.py`. Copy the settings into `.claude/settings.json` only after checking compatibility with your installed Claude Code version and merging with existing settings. The hook gives feedback after file edits under `examples/` or `work/` only; it is not a reliable merge gate. See VERIFICATION.md for handler tests and the separate Claude runtime result.

## CI

`.github/workflows/validate.yml` runs Python unit tests and demonstrates a known-bad artifact being rejected. To block merging, repository administrators must mark the workflow as a required status check in branch protection/rulesets. A passing check is not evidence of semantic correctness.

## What this kit intentionally does not do

- No automatic ticket submission or MCP integration. The decision-gates example ships an optional, off-by-default operator loop that reads a provider key and, only when you pass `--tracker`/`--pr`, writes back through a tracker API and opens a pull request with `gh`; it never stores credentials. Its Linear and git adapters are mock-tested — verify them against your own account and repository before relying on them.
- No pretend fixture factory or fake sandbox responses.
- The decision-gates example ships a labeled dataset and a calibration harness; no probabilistic decision-model integration is included without one.
- No claim that a simple regex can assess whether acceptance criteria are meaningful.

## Further inspiration

Shoalrun's authored templates demonstrate a richer contract approach: https://github.com/shoalrun/shoalrun/tree/main/framework/templates . Shoalrun is not a dependency of this kit. Its DocShape rules and Tengo scripts are included under Apache-2.0 with attribution and a license copy in vale/; the rest of Shoalrun is not required.

## SPCA references

CM-002 Structured Output Contracts; CM-003 Machine-Enforced Prose Standards; CM-009 Schema/Contract Validation; CM-008 Workflow Quality Gates & Monitoring. See TG-001 through TG-003 for the broader procedures.

## Codex and other agents (optional)

**To get automatic feedback in Codex, you need to add and enable the hook yourself.** The kit supplies example settings and a script; extracting it does not install the hook. Codex hook feedback worked in our explicit-configuration test; verify that your own setup runs it before relying on it.

The contract, template, Python command, and CI sample are agent-independent. AGENTS.md supplies the shared workflow. Keep required CI checks as the merge boundary; optional post-edit hooks cannot undo edits or prevent external writes.

For Codex, review `.codex/hooks.example.json` and `.codex/check-ticket-hook.py`. When the kit is the project root, merge the example into `.codex/hooks.json` alongside your active project config, then review/trust its exact definition using `/hooks`. This sample checks all Markdown drafts under `work/` after Bash, apply_patch, Write, or Edit events. Scanning the bounded draft directory avoids pretending Codex's patch input has Claude's `file_path` shape. It deliberately skips the built-in failing example. If the kit is nested in another repo, adjust the hook command to the kit's location and review the paths before enabling.

The Claude example checks edited Markdown under `examples/` or `work/`. Both wrappers call the same Python validation functions. Neither example is enabled by this archive. Review and merge settings; do not overwrite existing agent configuration. Handler tests are not proof of dispatch inside an agent. Live Codex feedback is verified only with reviewed session-inline configuration and one-invocation automation trust; project JSON/TOML loading did not dispatch in the isolated CLI test. Treat the bundled configuration as a compatibility example pending local verification. Claude live dispatch still needs authentication. See VERIFICATION.md.

Official references: [Codex hooks](https://learn.chatgpt.com/docs/hooks), [Claude Code hooks](https://code.claude.com/docs/en/hooks). Other agents can call `python3 tools/validate.py PATH` without either adapter.

## Validator scope

The validator uses a small Markdown subset for this ticket contract, not a full CommonMark parser. Structural checks ignore fenced code and HTML comments; TODO and filler checks scan the original text, including code examples. Checklist syntax does not prove that a criterion is measurable. It cannot verify HTTP behavior or referenced facts. Human review remains required.

## Pre-submission workflow

This release adds a **local mock** pre-submission gate, not a live Linear MCP integration. It validates the artifact, requires an explicit `--approve` flag for the mock side effect, captures a sanitized local receipt, and fails closed on unknown adapters.

```sh
python3 tools/submit_ticket.py examples/pass.md
python3 tools/submit_ticket.py examples/pass.md --approve
python3 tools/submit_ticket.py examples/fail.md --approve # expected failure
python3 -m unittest discover -s tests -v
```

Read `docs/PRE-SUBMISSION-WORKFLOW.md` before implementing a real MCP adapter.

`--approve` authorizes only the local demonstration receipt. It is not authentication or approval of a remote action. Review the ticket file itself: the preview returns validation metadata and a digest, not a semantic review of its text. Unknown adapters are rejected even without `--approve`. Each approved invocation creates a new mock receipt; this is not an idempotent remote submission service.

## License

SPCA Starter Kit is licensed under [Apache-2.0](LICENSE). Included Shoalrun DocShape attribution and license notices are retained under vale/; see NOTICE. The kit remains an editorial draft, regardless of its software license.

## Maintainer checks and packaging

Run from this repository root:

```sh
python3 -m unittest discover -s tests -v
python3 tools/check_vale.py
python3 scripts/package.py
```

Optional JavaScript dependencies and tests are documented in examples/tactical/README.md. Packaging writes dist/spca-starter-kit.zip and a SHA-256 file. It excludes activated agent settings, working drafts, mock receipts, caches and installed dependencies. No website checkout is required, and no model API is used unless you run the decision-gates example with your own key.
