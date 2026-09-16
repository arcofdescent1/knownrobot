const { spawnSync } = require('node:child_process');
const next = require.resolve('next/dist/bin/next');

function run(args, env) {
  const result = spawnSync(process.execPath, args, { env: { ...process.env, ...env }, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Preview smoke subprocess failed: ' + result.status);
}

try {
  run([next, 'build'], { VERCEL_ENV: 'preview' });
  run(['tests/production-smoke.cjs', '--preview'], { VERCEL_ENV: 'preview' });
} finally {
  // Static metadata and headers are build-time settings: restore a production artifact even on failure.
  run([next, 'build'], { VERCEL_ENV: 'production' });
}
