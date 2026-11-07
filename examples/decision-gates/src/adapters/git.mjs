// The git and gh adapter: branches, commits and pull requests as an explicit,
// printable plan.
//
// The kit decides; this adapter performs the repository side effects. Every
// step is a plain command, so `gitPlan` is pure — it can be printed (a dry run)
// or executed with an injected runner, which is also what the tests use. No
// key is read here; `gh` uses its own stored authentication.

import { spawnSync } from 'node:child_process';

// Build the ordered command plan for a pull request. Pure: no I/O, so it can be
// printed before anything runs.
//
// Branch and base names are validated against git's own ref-name rules, so a
// name like `--exec=evil` cannot be read as an option by `git` or `gh`.
const BRANCH_NAME = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

function requireBranchName(name, label) {
  if (!name) throw new Error(`gitPlan needs a ${label}`);
  if (!BRANCH_NAME.test(name)) throw new Error(`gitPlan has an invalid ${label}: ${name}`);
  return name;
}

export function gitPlan({ branch, paths, message, title, body, base = 'main', remote = 'origin' } = {}) {
  requireBranchName(branch, 'branch name');
  if (!paths || paths.length === 0) throw new Error('gitPlan needs at least one path to commit');
  if (!message) throw new Error('gitPlan needs a commit message');
  if (!title) throw new Error('gitPlan needs a pull request title');
  requireBranchName(base, 'base branch');
  return [
    { cmd: 'git', args: ['checkout', '-b', branch] },
    { cmd: 'git', args: ['add', '--', ...paths] },
    { cmd: 'git', args: ['commit', '-m', message] },
    { cmd: 'git', args: ['push', '-u', remote, branch] },
    { cmd: 'gh', args: ['pr', 'create', '--title', title, '--body', body ?? title, '--base', base, '--head', branch] },
  ];
}

// Quote one argument so the printed plan is safe to paste into a POSIX shell.
// Single quotes neutralize `$()`, backticks and backslashes; a literal single
// quote becomes the standard '\'' sequence. (Execution itself never uses a
// shell — this only protects the human who copies the plan.)
function shellQuote(value) {
  const text = String(value);
  if (text.length > 0 && /^[A-Za-z0-9_./:=@%+,-]+$/.test(text)) return text;
  return `'${text.replace(/'/g, `'\\''`)}'`;
}

// Render a step as a command that is safe to copy and paste.
export function formatCommand(step) {
  return [step.cmd, ...(step.args ?? []).map(shellQuote)].join(' ');
}

// The default runner: a synchronous spawn that captures output. Kept separate
// so tests can inject a fake and never touch a real repository.
export function defaultRun(step, { cwd } = {}) {
  const result = spawnSync(step.cmd, step.args, { cwd, encoding: 'utf8' });
  return { status: result.status ?? (result.error ? 1 : 0), stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

export function createGitAdapter({ run = defaultRun, cwd } = {}) {
  return {
    name: 'git',
    plan: gitPlan,
    // Execute every step in order and stop at the first failure, so a failed
    // push never leads to a pull request that points at nothing.
    async execute(plan) {
      const results = [];
      for (const step of plan) {
        const outcome = await run(step, { cwd });
        results.push({ ...step, ...outcome });
        if (outcome.status !== 0) throw new Error(`command failed (${outcome.status}): ${formatCommand(step)}`);
      }
      return results;
    },
  };
}
