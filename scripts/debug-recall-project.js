// Debug script for project-scope recall diagnostics
// Usage (PowerShell): node scripts/debug-recall-project.js

const core = require('../packages/core/src');
const cli = core.pouch.cli;

async function main() {
  // Bind current repo as project (required for scope=project)
  await cli.execute('project', [{ workingDirectory: process.cwd(), ideType: 'cursor' }], true);

  // Project-scope recall with diagnostics
  const out = await cli.execute(
    'recall',
    [{ role: 'js-dev', query: 'pnpm', scope: 'project', debug: true, mode: 'focused' }],
    true
  );

  const text = out && typeof out.toString === 'function' ? out.toString() : JSON.stringify(out, null, 2);
  // Print to stderr to avoid any stdout tooling assumptions
  console.error(text);
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(1);
});

