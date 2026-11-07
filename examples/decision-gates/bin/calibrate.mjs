#!/usr/bin/env node
// Evaluate one gate against its labeled dataset and report the numbers you
// choose routing bands from.
//
//   node bin/calibrate.mjs --gate testable-criteria --provider decisions --model typesafe/jev-1.14

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runGate, evaluate } from '../src/gate.mjs';
import { getGate } from '../src/gates/index.mjs';
import { openAiProvider, decisionsProvider } from '../src/provider.mjs';

function getProvider(name, model, baseUrl) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (name === 'decisions') return decisionsProvider({ apiKey, model, baseUrl });
  if (name === 'openai') return openAiProvider({ apiKey, model: model ?? 'openai/gpt-4o-mini', baseUrl });
  throw new Error(`unknown provider: ${name}`);
}

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i].startsWith('--')) {
    const key = argv[i].slice(2);
    args[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[(i += 1)] : true;
  }
}

if (args.help || !args.gate || !args.provider) {
  console.log(`Usage: node bin/calibrate.mjs --gate <id> --provider decisions|openai [--model <id>] [--data <file.jsonl>]

Runs a gate over its labeled dataset and reports accuracy, false approvals and
false rejections so you can choose routing bands. Requires a live provider.`);
  process.exit(args.help ? 0 : 2);
}

const gate = getGate(args.gate);
const provider = getProvider(args.provider, args.model, args['base-url']);
const dataFile = args.data ?? fileURLToPath(new URL(`../data/${gate.id}.jsonl`, import.meta.url));
const rows = readFileSync(dataFile, 'utf8').split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line));
const results = [];
for (const row of rows) results.push({ id: row.id, expected: row.expected, result: await runGate(gate, provider, row.state) });
console.log(JSON.stringify(evaluate(results), null, 2));
