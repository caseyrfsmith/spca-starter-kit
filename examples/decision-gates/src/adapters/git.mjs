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
export function gitPlan({ branch, paths, message, title, body, base = 'main', remote = 'origin' } = {}) {
  if (!branch) throw new Error('gitPlan needs a branch name');
  if (!paths || paths.length === 0) throw new Error('gitPlan needs at least one path to commit');
  if (!message) throw new Error('gitPlan needs a commit message');
  if (!title) throw new Error('gitPlan needs a pull request title');
  return [
    { cmd: 'git', args: ['checkout', '-b', branch] },
    { cmd: 'git', args: ['add', '--', ...paths] },
    { cmd: 'git', args: ['commit', '-m', message] },
    { cmd: 'git', args: ['push', '-u', remote, branch] },
    { cmd: 'gh', args: ['pr', 'create', '--title', title, '--body', body ?? title, '--base', base, '--head', branch] },
  ];
}

// Render a step as a copy-pasteable command. Arguments containing whitespace
// are quoted so the printed plan can be run by hand.
export function formatCommand(step) {
  const parts = [step.cmd, ...(step.args ?? []).map((arg) => (/\s|"/.test(arg) ? JSON.stringify(arg) : arg))];
  return parts.join(' ');
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
