#!/usr/bin/env node
// The operator loop: turn a ticket into a decision brief and, when asked, apply
// it — write the label, state and comment back to a tracker, and open a pull
// request.
//
//   node bin/operator.mjs plan --ticket work/tickets/slo-10.json
//   node bin/operator.mjs plan --ticket t.json \
//     --provider decisions --model typesafe/jev-1.14 \
//     --worker openai --worker-model openai/gpt-4o-mini
//   node bin/operator.mjs run --ticket t.json --ticket-id SLO-10 \
//     --tracker linear --pr --repo /path/to/repo \
//     --branch slo-10-decision-gates --paths content/a.mdx --paths content/b.mdx \
//     --pr-title "..." --dry-run
//
// `plan` is offline with the stub provider. `run` writes to the tracker and
// opens a pull request only when `--tracker` and `--pr` are given, and only
// when the route authorizes a pull request. `--dry-run` prints the steps
// without performing them. Live providers read OPENROUTER_API_KEY; the Linear
// adapter reads LINEAR_API_KEY.

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { getGate } from '../src/gates/index.mjs';
import { stubProvider, decisionsProvider, openAiProvider } from '../src/provider.mjs';
import { stubWorker, workerProvider } from '../src/worker.mjs';
import { runEscalation } from '../src/escalate.mjs';
import { planBrief, formatBrief, canOpenPullRequest } from '../src/operator.mjs';
import { gitPlan, formatCommand, createGitAdapter } from '../src/adapters/git.mjs';

const HELP = `Usage: node bin/operator.mjs <plan|run> --ticket <file.json> [options]

Turn a ticket into a decision brief, and optionally apply it.
  plan                     decide and print the brief (offline with the stub)
  run                      plan, then apply — write back and/or open a pull request

Decision:
  --gate <id>              gate to run (default: testable-criteria)
  --ticket <file.json>     the ticket; passed to the gate as { "ticket": ... }
  --ticket-id <id>         tracker id to use (default: the ticket filename)
  --provider               stub (offline demo), decisions, openai
  --model <id>             decision model
  --worker                 stub (offline demo) or openai
  --worker-model <id>      worker model (default: openai/gpt-4o-mini)
  --base-url <url>         base URL for both providers

Apply (run only):
  --tracker linear         write the label, state and comment back to Linear
  --pr                     open a pull request when the route authorizes it
  --repo <dir>             repository for the pull request (default: .)
  --branch <name>          branch to create
  --paths a,b              files to commit (repeatable)
  --pr-title <title>       pull request title
  --pr-body <body>         pull request body (default: the brief's comment)
  --base <branch>          pull request base (default: main)
  --dry-run                print the steps without performing them

Output:
  --json                   print the brief as JSON
  --help                   print this message`;

function parseArgs(argv) {
  const args = { paths: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help') args.help = true;
    else if (token === '--dry-run') args['dry-run'] = true;
    else if (token === '--json') args.json = true;
    else if (token === '--pr') args.pr = true;
    else if (token.startsWith('--')) {
      const key = token.slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[(i += 1)] : true;
      if (key === 'paths') {
        args.paths.push(...String(value).split(',').map((path) => path.trim()).filter(Boolean));
      } else {
        args[key] = value;
      }
    }
  }
  return args;
}

function makeProvider(args) {
  const gate = getGate(args.gate ?? 'testable-criteria');
  const name = args.provider ?? 'stub';
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (name === 'stub') return { gate, provider: stubProvider(gate.demo ?? {}) };
  if (name === 'decisions') return { gate, provider: decisionsProvider({ apiKey, model: args.model, baseUrl: args['base-url'] }) };
  if (name === 'openai') return { gate, provider: openAiProvider({ apiKey, model: args.model ?? 'openai/gpt-4o-mini', baseUrl: args['base-url'] }) };
  throw new Error(`unknown provider: ${name}`);
}

function makeWorker(args, gate) {
  const name = args.worker ?? 'stub';
  if (name === 'stub') return stubWorker(gate.escalation?.diagnosis ?? { summary: 'No diagnosis fixture.', vague: [], missing: [], suggested: [] });
  if (name === 'openai') return workerProvider({ apiKey: process.env.OPENROUTER_API_KEY, model: args['worker-model'] ?? 'openai/gpt-4o-mini', baseUrl: args['worker-base-url'] ?? args['base-url'] });
  throw new Error(`unknown worker: ${name}`);
}

async function openPullRequest(args, brief) {
  const plan = gitPlan({
    branch: args.branch,
    paths: args.paths,
    message: args['commit-message'] ?? args['pr-title'],
    title: args['pr-title'],
    body: args['pr-body'] ?? brief.comment,
    base: args.base,
  });
  if (args['dry-run']) {
    for (const step of plan) console.log(`  would run: ${formatCommand(step)}`);
    return null;
  }
  const adapter = createGitAdapter({ cwd: args.repo });
  const results = await adapter.execute(plan);
  const last = results[results.length - 1];
  const url = (last.stdout.match(/https?:\/\/\S+/) ?? [null])[0];
  console.log(`  opened pull request: ${url ?? '(check gh output)'}`);
  return url;
}

async function writeBack(args, brief, ticketId, pullRequestUrls) {
  if (args['dry-run']) {
    console.log(`  would apply label "${brief.actions.label}"${brief.actions.state ? ` and state "${brief.actions.state}"` : ''} to ${ticketId}`);
    console.log('  would post the decision comment');
    for (const url of pullRequestUrls) console.log(`  would attach ${url} to ${ticketId}`);
    return;
  }
  const { createLinearAdapter } = await import('../src/adapters/linear.mjs');
  const linear = createLinearAdapter({ apiKey: process.env.LINEAR_API_KEY });
  const ticket = await linear.getTicket(ticketId);
  const applied = await linear.applyBrief(ticket, brief);
  console.log(`  applied label "${applied.label}"${applied.state ? ` and state "${applied.state}"` : ''} to ${ticket.identifier}`);
  for (const url of pullRequestUrls) await linear.attachLink(ticket, { url, title: `Pull request for ${ticket.identifier}` });
}

async function main() {
  const argv = process.argv.slice(2);
  const first = argv[0];
  const command = first && !first.startsWith('--') ? first : 'plan';
  const args = parseArgs(command === first && first && !first.startsWith('--') ? argv.slice(1) : argv);

  if (args.help || !args.ticket) {
    console.log(HELP);
    return args.help ? 0 : 2;
  }

  const { gate, provider } = makeProvider(args);
  const worker = makeWorker(args, gate);
  const ticket = JSON.parse(readFileSync(args.ticket, 'utf8'));
  const ticketId = args['ticket-id'] ?? basename(args.ticket, '.json');

  const result = await runEscalation({ gate, provider, worker, state: { ticket } });
  const brief = planBrief({ id: ticketId, ticket, result });

  if (args.json) console.log(JSON.stringify(brief, null, 2));
  else console.log(formatBrief(brief));

  if (command !== 'run') return 0;

  const pullRequestUrls = [];
  if (args.pr) {
    if (!canOpenPullRequest(brief)) {
      console.error(`refused: route "${brief.route}" does not authorize a pull request`);
      return 1;
    }
    if (!args.branch || args.paths.length === 0 || !args['pr-title']) {
      console.error('refused: --pr needs --branch, --paths and --pr-title');
      return 1;
    }
    const url = await openPullRequest(args, brief);
    if (url) pullRequestUrls.push(url);
  }

  if (args.tracker === 'linear') {
    await writeBack(args, brief, ticketId, pullRequestUrls);
  }

  return 0;
}

main().then((code) => {
  process.exitCode = code;
}).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
