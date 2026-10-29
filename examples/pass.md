# Reject duplicate customer IDs in the sandbox

## Problem

Sandbox users can submit a customer ID already assigned to another customer. The resulting error is inconsistent across requests.

## Expected behavior

A second create request using an existing customer ID returns HTTP 409 and does not create another record.

## Acceptance criteria

- [ ] Creating a customer with a new ID succeeds.
- [ ] Reusing the ID returns HTTP 409.
- [ ] The sandbox contains only one record for that ID.

## References

No external references available; validate against the sandbox API contract before implementation.
