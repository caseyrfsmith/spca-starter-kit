// The Linear adapter: read a ticket, write a brief back, and attach pull-request
// links.
//
// This adapter is optional and off by default. The kit's core stays offline;
// this file is loaded only when `--tracker linear` is passed. It reads the key
// the caller supplies and never writes it anywhere.
//
// Verification: the request and response shapes are checked against a mock in
// the offline tests, and the write-back was verified once against a real Linear
// workspace on 2026-11-07 (`bin/live-linear.mjs`, read-only against one ticket
// and label/state/comment/attachment against a scratch ticket). Confirm the
// shapes and the label and state names against your own account before relying
// on it in production. The kit's core decision path does not depend on this
// file.

const ENDPOINT = 'https://api.linear.app/graphql';

const ISSUE_QUERY = `query Ticket($id: String!) {
  issue(id: $id) {
    id
    identifier
    title
    description
    url
    state { id name }
    team {
      id
      key
      name
      states { nodes { id name type } }
      labels { nodes { id name } }
    }
    labels { nodes { id name } }
  }
}`;

const UPDATE_MUTATION = `mutation Update($id: String!, $input: IssueUpdateInput!) {
  issueUpdate(id: $id, input: $input) { success issue { id } }
}`;

const COMMENT_MUTATION = `mutation Comment($input: CommentCreateInput!) {
  commentCreate(input: $input) { success comment { id url } }
}`;

const ATTACH_MUTATION = `mutation Attach($input: AttachmentCreateInput!) {
  attachmentCreate(input: $input) { success attachment { id url } }
}`;

const LABEL_MUTATION = `mutation Label($input: IssueLabelCreateInput!) {
  issueLabelCreate(input: $input) { success issueLabel { id name } }
}`;

const LABEL_COLOR = '#6b7280';

export function createLinearAdapter({ apiKey, endpoint = ENDPOINT, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error('the linear adapter needs an apiKey (set LINEAR_API_KEY)');

  async function gql(query, variables) {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: apiKey },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) throw new Error(`linear HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.errors?.length) {
      throw new Error(`linear error: ${payload.errors.map((error) => error.message).join('; ')}`);
    }
    return payload.data;
  }

  // Read one ticket by its identifier (for example SLO-10) or UUID. Returned
  // normalized: the states and labels a brief needs to resolve are flattened.
  async function getTicket(id) {
    const data = await gql(ISSUE_QUERY, { id });
    const issue = data?.issue;
    if (!issue) throw new Error(`linear issue "${id}" not found`);
    return {
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description ?? '',
      url: issue.url,
      state: issue.state ?? null,
      team: { id: issue.team.id, key: issue.team.key, name: issue.team.name },
      labels: (issue.labels?.nodes ?? []).map((label) => label.name),
      states: issue.team?.states?.nodes ?? [],
      teamLabels: issue.team?.labels?.nodes ?? [],
    };
  }

  async function createLabel(name, teamId) {
    const data = await gql(LABEL_MUTATION, { input: { name, teamId, color: LABEL_COLOR } });
    const payload = data?.issueLabelCreate;
    if (!payload?.success || !payload.issueLabel) throw new Error(`linear could not create label "${name}"`);
    return payload.issueLabel;
  }

  function findLabel(ticket, name) {
    const wanted = String(name).toLowerCase();
    return (ticket.teamLabels ?? []).find((label) => label.name.toLowerCase() === wanted) ?? null;
  }

  function findState(ticket, name) {
    const wanted = String(name).toLowerCase();
    return (ticket.states ?? []).find((state) => state.name.toLowerCase() === wanted) ?? null;
  }

  // Apply a brief: resolve (or create) the label, clear the policy's other
  // labels, move the state, and post the comment. Resolving first keeps the
  // write-back idempotent in effect, and clearing the others means a ticket
  // never carries two contradictory decision labels.
  async function applyBrief(ticket, brief) {
    const input = {};
    let appliedLabel = null;
    if (brief.actions.label) {
      let label = findLabel(ticket, brief.actions.label);
      if (!label) label = await createLabel(brief.actions.label, ticket.team.id);
      input.addedLabelIds = [label.id];
      appliedLabel = label.name;
    }

    // Only remove labels the ticket actually carries: Linear rejects a removal
    // for a label that is not on the issue ("Label not on issue").
    const onTicket = new Set((ticket.labels ?? []).map((name) => name.toLowerCase()));
    const removed = [];
    const removedIds = [];
    for (const name of brief.actions.removeLabels ?? []) {
      if (!onTicket.has(String(name).toLowerCase())) continue;
      const label = findLabel(ticket, name);
      if (label) {
        removedIds.push(label.id);
        removed.push(label.name);
      }
    }
    if (removedIds.length) input.removedLabelIds = removedIds;

    if (brief.actions.state) {
      const state = findState(ticket, brief.actions.state);
      if (!state) throw new Error(`linear state "${brief.actions.state}" not found on team ${ticket.team.key}`);
      input.stateId = state.id;
    }

    const updated = await gql(UPDATE_MUTATION, { id: ticket.id, input });
    if (!updated?.issueUpdate?.success) throw new Error(`linear did not apply the update to ${ticket.identifier ?? ticket.id}`);

    const commented = await gql(COMMENT_MUTATION, { input: { issueId: ticket.id, body: brief.comment } });
    if (!commented?.commentCreate?.success) throw new Error(`linear did not post the comment on ${ticket.identifier ?? ticket.id}`);

    return {
      id: ticket.id,
      label: appliedLabel,
      state: brief.actions.state ?? null,
      removed,
      updated: true,
      commentUrl: commented.commentCreate.comment?.url ?? null,
    };
  }

  // Attach a link (typically a pull request) to the ticket.
  async function attachLink(ticket, { url, title }) {
    const data = await gql(ATTACH_MUTATION, { input: { issueId: ticket.id, title: title ?? url, url } });
    const payload = data?.attachmentCreate;
    if (!payload?.success || !payload.attachment) throw new Error(`linear could not attach "${url}"`);
    return payload.attachment;
  }

  return { name: 'linear', getTicket, applyBrief, attachLink };
}
