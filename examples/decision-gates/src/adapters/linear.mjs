// The Linear adapter: read a ticket, write a brief back, and attach pull-request
// links.
//
// This adapter is optional and off by default. The kit's core stays offline;
// this file is loaded only when `--tracker linear` is passed. It reads the key
// the caller supplies and never writes it anywhere.
//
// Honesty about the boundary: the GraphQL calls below are exercised against a
// mock in the tests, not against a live workspace. Verify the live request and
// response shapes and the label/state names against your own Linear account
// before relying on the write-back. The kit's core decision path does not
// depend on this file.

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
    return data.issueLabelCreate.issueLabel;
  }

  function findState(ticket, name) {
    const wanted = String(name).toLowerCase();
    return (ticket.states ?? []).find((state) => state.name.toLowerCase() === wanted) ?? null;
  }

  // Apply a brief: resolve (or create) the label, move the state, and post the
  // comment. Resolving first keeps the write-back idempotent in effect: the
  // label is added, never duplicated.
  async function applyBrief(ticket, brief) {
    const labelName = brief.actions.label;
    let label = (ticket.teamLabels ?? []).find((candidate) => candidate.name === labelName);
    if (!label) label = await createLabel(labelName, ticket.team.id);

    const input = { addedLabelIds: [label.id] };
    if (brief.actions.state) {
      const state = findState(ticket, brief.actions.state);
      if (!state) throw new Error(`linear state "${brief.actions.state}" not found on team ${ticket.team.key}`);
      input.stateId = state.id;
    }

    const updated = await gql(UPDATE_MUTATION, { id: ticket.id, input });
    const commented = await gql(COMMENT_MUTATION, { input: { issueId: ticket.id, body: brief.comment } });
    return {
      id: ticket.id,
      label: label.name,
      state: brief.actions.state ?? null,
      updated: Boolean(updated.issueUpdate.success),
      commentUrl: commented.commentCreate.comment?.url ?? null,
    };
  }

  // Attach a link (typically a pull request) to the ticket.
  async function attachLink(ticket, { url, title }) {
    const data = await gql(ATTACH_MUTATION, { input: { issueId: ticket.id, title: title ?? url, url } });
    return data.attachmentCreate.attachment;
  }

  return { name: 'linear', getTicket, applyBrief, attachLink };
}
