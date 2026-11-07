#!/usr/bin/env node
// Run the verified cascade over a draft.
//
//   node bin/pipeline.mjs --state draft.json --provider decisions --model typesafe/jev-1.14
//
// The state file supplies the material the gates read, for example:
//   { "draft": "the proposed text", "source": "the authoritative material" }

import { readFileSync } from 'node:fs';
import { runCascade } from '../src/pipeline.mjs';
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

if (args.help || !args.state || !args.provider) {
  console.log(`Usage: node bin/pipeline.mjs --state <file.json> --provider decisions|openai [--model <id>]

Runs the verified cascade (the verification gates) over a draft and prints the
combined route and each gate result. Requires a live provider.`);
  process.exit(args.help ? 0 : 2);
}

const state = JSON.parse(readFileSync(args.state, 'utf8'));
const provider = getProvider(args.provider, args.model, args['base-url']);
console.log(JSON.stringify(await runCascade(provider, state), null, 2));
