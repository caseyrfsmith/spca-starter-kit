#!/usr/bin/env node
// Run the deterministic checks over a Markdown file. Offline; no model, no key.
//
//   node bin/check.mjs path/to/page.md --require Summary --require Limitations
//
// In a real workflow these checks are Vale (prose) and your template or
// page-shape rules — see the kit's vale/ and examples/tactical/.vale.ini. This
// example ships a small shape check so the ordering can be run without them.

import { readFileSync } from 'node:fs';
import { docShape, runChecks } from '../src/checks.mjs';

function main() {
  const argv = process.argv.slice(2);
  const args = { requiredHeadings: [] };
  let file = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--help') args.help = true;
    else if (argv[i] === '--require') {
      const heading = argv[i + 1];
      if (heading === undefined || heading.startsWith('--')) throw new Error('--require needs a heading');
      args.requiredHeadings.push(heading);
      i += 1;
    } else if (!argv[i].startsWith('--')) file = argv[i];
  }

  if (args.help || !file) {
    console.log('Usage: node bin/check.mjs <file.md> [--require <Heading> ...]\n\nRuns the deterministic checks (here, a shape check) and prints the route.');
    return args.help ? 0 : 2;
  }

  const markdown = readFileSync(file, 'utf8');
  console.log(JSON.stringify(runChecks([docShape], { markdown, requiredHeadings: args.requiredHeadings }), null, 2));
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
