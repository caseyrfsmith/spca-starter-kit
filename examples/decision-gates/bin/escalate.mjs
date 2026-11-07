#!/usr/bin/env node
// Run a gate; if it does not pass, diagnose it with a worker.
//
//   node bin/escalate.mjs --gate testable-criteria --ticket work/tickets/slo-9.json
//   node bin/escalate.mjs --gate testable-criteria --ticket work/tickets/slo-9.json \
//     --provider decisions --model typesafe/jev-1.14 \
//     --worker openai --worker-model openai/gpt-4o-mini
//
// The gate decides the route. The worker only explains why the gate did not
// pass. The route in the output is the gate's, never the worker's.
//
// Live providers read OPENROUTER_API_KEY from the environment.

import { readFileSync } from 'node:fs';
import { getGate } from '../src/gates/index.mjs';
import { stubProvider, decisionsProvider, openAiProvider } from '../src/provider.mjs';
import { stubWorker, workerProvider } from '../src/worker.mjs';
import { runEscalation } from '../src/escalate.mjs';

const HELP = `Usage: node bin/escalate.mjs --gate <id> <--ticket|--state> <file> [options]

Run a gate; when it does not pass, ask a worker to diagnose why.
  --gate <id>              gate to run (default: testable-criteria)
  --ticket <file.json>     wrap the file as { "ticket": ... }
  --state <file.json>      use the file as the whole state object
  --provider               stub (offline demo), decisions, openai
  --model <id>             decision model
  --worker                 stub (offline demo) or openai
  --worker-model <id>      worker model (default: openai/gpt-4o-mini)
  --base-url <url>         base URL for both providers
  --comment-only           print only the diagnosis as Markdown, ready to post
Live providers read OPENROUTER_API_KEY from the environment.`;

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help') args.help = true;
    else if (token.startsWith('--')) {
      const key = token.slice(2);
      args[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[(i += 1)] : true;
    }
  }
  return args;
}

function makeProvider(args, gate) {
  const name = args.provider ?? 'stub';
  if (name === 'stub') return stubProvider(gate.escalation?.decision ?? gate.demo ?? {});
  if (name === 'decisions') return decisionsProvider({ apiKey: process.env.OPENROUTER_API_KEY, model: args.model, baseUrl: args['base-url'] });
  if (name === 'openai') return openAiProvider({ apiKey: process.env.OPENROUTER_API_KEY, model: args.model ?? 'openai/gpt-4o-mini', baseUrl: args['base-url'] });
  throw new Error(`unknown provider: ${name}`);
}

function makeWorker(args, gate) {
  const name = args.worker ?? 'stub';
  if (name === 'stub') {
    const fallback = { summary: 'No diagnosis fixture.', vague: [], missing: [], suggested: [] };
    return stubWorker(gate.escalation?.diagnosis ?? fallback);
  }
  if (name === 'openai') {
    return workerProvider({ apiKey: process.env.OPENROUTER_API_KEY, model: args['worker-model'] ?? 'openai/gpt-4o-mini', baseUrl: args['worker-base-url'] ?? args['base-url'] });
  }
  throw new Error(`unknown worker: ${name}`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !(args.ticket || args.state)) {
    console.log(HELP);
    return args.help ? 0 : 2;
  }
  const gate = getGate(args.gate ?? 'testable-criteria');
  const file = args.ticket ?? args.state;
  const parsed = JSON.parse(readFileSync(file, 'utf8'));
  const state = args.ticket ? { ticket: parsed } : parsed;
  const provider = makeProvider(args, gate);
  const worker = makeWorker(args, gate);
  const result = await runEscalation({ gate, provider, worker, state });
  if (args['comment-only']) {
    console.log(result.comment ?? `(no diagnosis for route \`${result.route}\`)`);
    return 0;
  }
  console.log(JSON.stringify(result, null, 2));
  return 0;
}

main().then((code) => {
  process.exitCode = code;
}).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
