# Report request timeout failures

## Problem
Support cannot distinguish a failed request from a delayed response in the current status view. Fixture CASE-001 reproduces this synthetic failure.

## Expected outcome
The status view displays an explicit timeout state for the affected request.

## Acceptance criteria
- [ ] A timed-out request displays a timeout status.
- [ ] A successful request continues to display its success status.

## Context and references
CASE-001 is a synthetic development fixture, not a real incident.
