#!/usr/bin/env node
// Run one gate over one input and print the typed verdict.
//
//   node bin/gate.mjs --list
//   node bin/gate.mjs --ticket tickets/example-ticket.json
//   node bin/gate.mjs --gate docs-needed --state change.json --provider decisions --model typesafe/jev-1.14
//
// --ticket wraps the file as { ticket: ... }; --state passes the file as the
// whole state object. Live providers read OPENROUTER_API_KEY from the
// environment; it is never printed or written to disk.

import { readFileSync } from 'node:fs';
import { runGate } from '../src/gate.mjs';
import { getGate, listGates } from '../src/gates/index.mjs';
import { stubProvider, openAiProvider, decisionsProvider } from '../src/provider.mjs';

const HELP = `Usage: node bin/gate.mjs (--list | --gate <id> <--ticket|--state> <file>) [--provider stub|decisions|openai] [--model <id>] [--base-url <url>]

Run one decision gate and print the typed verdict.
  --list                 list the available gates
  --gate <id>            gate to run (default: testable-criteria)
  --ticket <file.json>   wrap the file as { "ticket": ... }
  --state <file.json>    use the file as the whole state object
  --provider             stub (offline demo), decisions (TypeSafe Jev and similar), openai
Live providers read OPENROUTER_API_KEY from the environment.`;

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help') args.help = true;
    else if (token === '--list') args.list = true;
    else if (token.startsWith('--')) {
      const key = token.slice(2);
      args[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[(i += 1)] : true;
    }
  }
  return args;
}

function makeProvider(args, gate) {
  const name = args.provider ?? 'stub';
  if (name === 'stub') {
    return { provider: stubProvider(gate.demo ?? {}), note: 'DEMO: the stub returns fixed answers. Use --provider decisions for a real decision.' };
  }
  if (name === 'decisions') {
    return { provider: decisionsProvider({ apiKey: process.env.OPENROUTER_API_KEY, model: args.model, baseUrl: args['base-url'] }) };
  }
  if (name === 'openai') {
    return { provider: openAiProvider({ apiKey: process.env.OPENROUTER_API_KEY, model: args.model ?? 'openai/gpt-4o-mini', baseUrl: args['base-url'] }) };
  }
  throw new Error(`unknown provider: ${name}`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.list) {
    console.log(JSON.stringify(listGates(), null, 2));
    return 0;
  }
  if (args.help || !(args.ticket || args.state)) {
    console.log(HELP);
    return args.help ? 0 : 2;
  }
  const gate = getGate(args.gate ?? 'testable-criteria');
  const file = args.ticket ?? args.state;
  const parsed = JSON.parse(readFileSync(file, 'utf8'));
  const state = args.ticket ? { ticket: parsed } : parsed;
  const { provider, note } = makeProvider(args, gate);
  const result = await runGate(gate, provider, state);
  if (note) result.note = note;
  console.log(JSON.stringify(result, null, 2));
  return 0;
}

main().then((code) => {
  process.exitCode = code;
}).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
