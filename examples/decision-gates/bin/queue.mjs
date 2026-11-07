#!/usr/bin/env node
// The operator queue: run a gate over a directory of tickets and print what
// needs attention. This is the view an operator works from.
//
//   node bin/queue.mjs --gate testable-criteria --dir work/tickets
//   node bin/queue.mjs --gate testable-criteria --dir work/tickets \
//     --provider decisions --model typesafe/jev-1.14 \
//     --worker openai --worker-model openai/gpt-4o-mini
//
// Each ticket is a JSON file in the shape of tickets/example-ticket.json. The
// gate decides the route; the worker (optional) diagnoses the ones that fail.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getGate } from '../src/gates/index.mjs';
import { stubProvider, decisionsProvider, openAiProvider } from '../src/provider.mjs';
import { stubWorker, workerProvider } from '../src/worker.mjs';
import { runEscalation } from '../src/escalate.mjs';
import { runGate } from '../src/gate.mjs';
import { formatQueue } from '../src/report.mjs';

const HELP = `Usage: node bin/queue.mjs --gate <id> --dir <folder> [options]

Run a gate over every *.json ticket in a folder and print the operator queue.
  --gate <id>              gate to run (default: testable-criteria)
  --dir <folder>           folder of ticket JSON files (default: tickets)
  --provider               stub (offline demo), decisions, openai
  --model <id>             decision model
  --worker                 none (default), stub (demo) or openai
  --worker-model <id>      worker model (default: openai/gpt-4o-mini)
  --base-url <url>         base URL for both providers
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
  if (name === 'stub') return stubProvider(gate.demo ?? {});
  if (name === 'decisions') return decisionsProvider({ apiKey: process.env.OPENROUTER_API_KEY, model: args.model, baseUrl: args['base-url'] });
  if (name === 'openai') return openAiProvider({ apiKey: process.env.OPENROUTER_API_KEY, model: args.model ?? 'openai/gpt-4o-mini', baseUrl: args['base-url'] });
  throw new Error(`unknown provider: ${name}`);
}

function makeWorker(args, gate) {
  const name = args.worker ?? 'none';
  if (name === 'none') return null;
  if (name === 'stub') return stubWorker(gate.escalation?.diagnosis ?? { summary: 'No diagnosis fixture.', vague: [], missing: [], suggested: [] });
  if (name === 'openai') return workerProvider({ apiKey: process.env.OPENROUTER_API_KEY, model: args['worker-model'] ?? 'openai/gpt-4o-mini', baseUrl: args['worker-base-url'] ?? args['base-url'] });
  throw new Error(`unknown worker: ${name}`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(HELP);
    return 0;
  }
  const gate = getGate(args.gate ?? 'testable-criteria');
  const provider = makeProvider(args, gate);
  const worker = makeWorker(args, gate);
  const dir = args.dir ?? 'tickets';
  const files = readdirSync(dir).filter((file) => file.endsWith('.json')).sort();

  const items = [];
  for (const file of files) {
    const id = file.replace(/\.json$/, '');
    const ticket = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    const result = worker
      ? await runEscalation({ gate, provider, worker, state: { ticket } })
      : await runGate(gate, provider, { ticket });
    items.push({ id, title: ticket.title, result });
  }

  console.log(formatQueue(items, { gate: gate.id, provider: provider.name }));
  return 0;
}

main().then((code) => {
  process.exitCode = code;
}).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
