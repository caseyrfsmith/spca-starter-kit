# Pre-submission quality gate: local reference implementation

This example **does not submit to Linear**. It demonstrates a fail-closed gate with an explicit human authorization step and a local mock adapter. A real MCP integration must be implemented and tested in the consuming environment; never treat a mock receipt as proof that a remote ticket exists.

## Workflow

1. Generate a ticket from `templates/linear-ticket.md`, retaining TODOs for missing facts.
2. Run `python3 tools/submit_ticket.py examples/pass.md` to validate and preview. No submission occurs.
3. Review semantic quality and business context manually; the validator cannot determine these.
4. Run `python3 tools/submit_ticket.py examples/pass.md --approve` to simulate an authorized submission to the local mock.
5. Inspect the receipt in `.spca-receipts/`; it records a hash of the validated source, mock ticket ID, and timestamp, **not** remote acceptance.
6. For a real integration, implement a separately reviewed adapter that maps the approved artifact to the current Linear MCP tool schema, calls the tool, then reads back the created ticket and compares title and description to the approved content. Capture a sanitized remote ID and response. Fail closed on errors or mismatches.

## Safety and enforcement boundaries

- `--approve` is an explicit local approval flag, **not** a secure identity/authentication mechanism. For real use, approval must be bound to an authorized actor and an immutable artifact version.
- The file is re-read and revalidated on each invocation. The recorded SHA-256 digest identifies the content that was checked.
- Do not pass credentials through the agent prompt, command arguments, or captured receipts. The adapter must manage auth through an appropriately isolated credential mechanism.
- A real adapter should require explicit authorization before external side effects, use least privilege, handle duplicates/idempotency, and verify the created ticket by independent read-back.
- Never expose a general-purpose shell command adapter or let the agent silently select another endpoint.
- Local validation and a mock receipt do not prove semantic correctness or successful remote submission.

## Failure injection

| Test | Expected result |
|---|---|
| Valid ticket without `--approve` | `ready_for_approval`, no receipt |
| TODO in ticket, with `--approve` | Blocked |
| Invalid structure, with `--approve` | Blocked |
| Valid ticket, `--approve`, mock adapter | Local receipt created |
| `--adapter linear` | Blocked until a verified adapter exists |
| Change ticket after preview | New validation and new hash on subsequent invocation |

## Extension contract for a real MCP adapter

A production adapter should implement a narrow operation: `create_ticket(approved_title, approved_description, project_id, idempotency_key) -> remote_ticket_id`, plus `read_ticket(remote_ticket_id)` for independent verification. The actual MCP tool names and schemas must be discovered from the user's connected Linear integration; they are intentionally not invented here.

## Draft integration notes

Only the local mock is implemented. Unsupported adapters are blocked with or without approval. Preview is metadata plus the current source digest; review the actual ticket file for meaning before using the local approval flag. The digest covers the exact UTF-8 file bytes, including line endings. Each approved invocation re-reads and revalidates the file; it does not bind a previous preview or a human identity to that digest. It creates a fresh mock ID and receipt each time, with no idempotency promise. A later real adapter would need separately approved authorization, immutable approved-content binding, verified schema, duplicate handling, and independent remote read-back. None is implemented here.

Receipts omit ticket text and credentials but contain a source path and timestamp. Review those metadata fields before sharing them; a local receipt is never proof of a remote ticket. See ../VERIFICATION.md for the observed test scope.
