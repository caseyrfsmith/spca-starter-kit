# Starter Kit — Draft verification record

Checked locally on 2026-10-28. This toolkit remains an editorial draft, not a certification. Nothing has been deployed or installed into the site's agent settings.

| Check | Result |
| --- | --- |
| Supplied Python tests | 10 passed (five contract and five submission tests) |
| Added adapter/contract/submission boundary tests | 10 passed (six retained and four new) |
| Good/bad CLI fixtures | Good exits 0; bad exits 1 with missing-section, TODO and filler findings |
| Vale 3.24.0 | Actual binary: passing fixture clean; TODO error and filler warnings detected; warning-only text does not fail the error-only gate |
| Claude handler | Python subprocess tests: valid/invalid/relative paths, malformed input, missing targets, outside paths and symlink escapes |
| Claude Code 2.1.312 live PostToolUse | Attempted with isolated settings and only Write enabled; CLI exits 1 and reports Not logged in. No edit occurred; dispatch and agent-visible feedback remain unverified |
| Codex CLI 0.165.0 live PostToolUse | Outside the restricted runner, reviewed inline configuration delivers real patch/shell feedback: invalid patch 2, valid shell 0, invalid shell 2, valid patch 0. Project hooks.json and project TOML attempts completed edits but did not dispatch; interactive trust/discovery remain unverified |
| Python runtime | Tests executed with the available Python 3.9.6. Package recommendation remains Python 3.10+ (3.12 preferred); those versions were not available here and are not claimed tested |
| Hosted CI / merge rules | Sample only; not run on GitHub and no branch protection configured |

## Reproduce the local checks

From the extracted kit root:

```sh
python3 --version
python3 -m unittest discover -s tests -v
python3 tools/validate.py examples/pass.md
python3 tools/validate.py examples/fail.md  # expected exit 1
python3 tools/check_vale.py                # requires Vale on PATH
```

The unit suite uses Python subprocesses and event-shaped inputs; it does not prove agent hook dispatch. A separate live Codex test now proves dispatch and agent-visible feedback with session-inline hooks and one-invocation automation trust. The original restricted-runner Operation not permitted error was overcome by running outside that runner. This does not verify the bundled project configuration or interactive /hooks trust flow. To finish runtime review on a machine where each agent works, copy this kit into a disposable directory, review and merge just that agent's example settings, and edit `work/runtime-ticket.md` through the agent with an incomplete ticket. Confirm the real PostToolUse event delivers violations, then replace it with the passing example and confirm clean feedback. Check that an edit outside `examples/`/`work/` is ignored by Claude, and that Codex scans `work/` after both patch and shell edits. Review Codex hook trust through `/hooks`. Neither agent test should touch production or remote tickets. Preserve the real event/tool names, exit codes, feedback and agent version in the review record; do not relabel synthetic handler tests as live results.

## Mock-only pre-submission results

`tools/submit_ticket.py` has no network client, MCP call or Linear adapter. Actual CLI tests confirm: valid/no approval returns `ready_for_approval` with exit 0 and no receipt; invalid/approved returns `blocked` with exit 1; unsupported adapters return `blocked` with exit 1 both with and without approval; valid/approved mock returns `submitted_to_mock` with exit 0 and a local `MOCK-` receipt. Missing input or an unwritable receipt location returns a blocked input error. Receipts retain the exact source-byte SHA-256, mock marker and local timestamp, and omit ticket text.

The ten provided tests and ten integration/boundary tests pass (20 total). CRLF/newline digest tests and valid/invalid post-preview changes confirm that each invocation re-reads and revalidates content. This is not immutable approval binding or remote read-back. Every approved invocation creates a new local receipt, not an idempotent remote operation.

## Integration corrections and limitations

- Added `mkdir -p work` before the quick-start copy.
- Kept the original contract and examples. Structural checks now ignore HTML comments and fenced examples so those cannot supply missing contract headings or empty-section content. This remains a small Markdown subset, not a full Markdown parser.
- TODO and filler scanning deliberately includes code. The Vale rules needed no syntax correction and remain illustrative; the Python validator's TODO match is case-insensitive, while the supplied Vale TODO rule matches uppercase TODO.
- Shared hook code resolves Claude relative paths from the event cwd and constrains reads to the kit's examples/work directories. Codex scans only the bounded work directory rather than assuming Claude's file_path input. Symlink escapes are ignored. The installed kit directory is the scope boundary; this is not a security sandbox.
- PostToolUse cannot roll back a completed edit. Disabled hooks, unsupported tool paths, external edits and incomplete draft discovery can bypass feedback. Use the explicit validator and required CI on your real ticket corpus. The included CI only checks examples and tests; adapt it to check actual submitted ticket files.
- Neither linting nor structural validity proves usefulness, correctness, testability, or successful product behavior. Human review and product evidence remain necessary. No Linear connection, Shoalrun runtime, credentials, model API client or live product integration is included.

Official adapter contracts reviewed: [Claude Code hooks](https://code.claude.com/docs/en/hooks), [Codex hooks](https://learn.chatgpt.com/docs/hooks). Current source documentation does not establish runtime compatibility on every installed agent version.

- Corrected the quick-start directory setup and retained Markdown and optional Codex improvements.
- Moved unknown-adapter rejection before preview/approval handling, so unsupported adapters fail closed without approval too. Changed digest calculation to exact UTF-8 source bytes so line endings are included. Added CLI failure/receipt/hash tests. The mock remains mock-only; no real approval identity or external submission is implemented.

## Disposable runtime follow-up — 2026-10-28

Codex 0.165.0 completed four real edits in a fresh local Git repository copied from this kit. With `--enable hooks`, session-inline `hooks.PostToolUse`, and the documented `--dangerously-bypass-hook-trust` automation option after source review, the audit recorded `apply_patch:2`, `Bash:0`, `Bash:2`, `apply_patch:0`. Both invalid edits delivered the four missing-section findings to the model; both passing edits produced empty hook stderr. The final file matched `examples/pass.md` byte-for-byte. The copied wrapper recorded only event name, tool name, return code and stderr, while calling the unchanged shared handler. The production wrapper was not instrumented.

The same matching command in project `hooks.json`, and then in project `config.toml`, did **not** dispatch in the isolated `--no-daemon --ignore-user-config` invocation, even with a trusted project session override and hooks enabled. The cause is unresolved; do not describe automatic project loading as verified. No persisted trust was changed. The automation option bypasses the interactive trust check, so `/hooks` acceptance is still open. A preliminary inline run also showed that scanning every Bash event can replace read-command output while an invalid draft exists; post-edit feedback is not a complete enforcement boundary.

Claude Code 2.1.312 again exited 1 with `authentication_failed` / Not logged in before any Write call. Live Claude invalid/valid/outside-scope dispatch remains blocked by authentication; no credentials were accessed or changed.

The parent SPCA repository contains exact invocation records, agent events, hook audit and an opt-in reproduction script under `editorial/hook-verification/`. These logs use illustrative local ticket fixtures, not real product evidence. No hooks were activated in the maintained toolkit or SPCA project.

## Bundled guide examples

The examples index now includes the optional standalone Node parser/mock adapter/Vale handler, the exact TG-002 rules and fixtures, licensed DocShape rule/scripts and page-shape fixtures, and a generated catalog of guide/reference code blocks. The original Python workflow and mock-only submission boundary are unchanged. The original Vale configuration, TG-002 configuration and DocShape configuration are deliberately separate. Run tools/check_vale.py for all three; see examples/README.md. Snippet collection does not make illustrative provider or fixture commands executable, or establish live agent hook dispatch.

Fresh-archive verification on 2026-10-28: extracted the ZIP outside the site checkout, ran all 22 Python tests and all three Vale configurations successfully, then ran npm ci --offline --ignore-scripts in examples/tactical using the available package cache. All five Node tests and npm run check passed. This verifies the pinned dependency install and local examples; it does not test network installation on another machine, a live Linear integration or new live hook dispatch. The distribution excludes node_modules; examples/snippets.json lists the current labelled code blocks and their guide/reference sources.

## Standalone repository — 2026-10-28

The kit is now independent of the private website, under Apache-2.0 with CT Smith's copyright and preserved DocShape notices. Its own scripts/package.py creates the standalone archive without reading the website checkout.

Validation after separation: all 24 Python tests passed (including archive exclusion/determinism and symlink tests), all 5 optional JavaScript tests and the corpus check passed, and actual Vale verified all three configurations. Repeated those checks after extracting a fresh archive into a path containing spaces; the optional npm dependencies installed from the local cache. Packaging excludes activated hooks, environment files, working drafts, mock receipts, Git internals and node_modules. No new live hook/provider verification or Python 3.12 result is claimed; previous runtime limitations still apply.
