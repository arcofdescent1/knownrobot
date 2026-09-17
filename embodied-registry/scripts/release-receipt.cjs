const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const fileDigest = file => {
  const value = fs.readFileSync(file);
  return sha256(value.includes(0) ? value : Buffer.from(value.toString('utf8').replaceAll('\r\n', '\n')));
};
function receipt(sourceRoot = root) {
  const root = sourceRoot;
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore','pipe','ignore'] });
  let revision = null, dirty = null, files = [], scope = 'application_snapshot_without_git';
  try {
    revision = git(['rev-parse', 'HEAD']).trim();
    if (!/^[a-f0-9]{40}$/.test(revision)) throw Error('Invalid source revision');
    dirty = !!git(['status', '--porcelain', '--untracked-files=normal']).trim();
    files = [...new Set(git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean))].sort();
    scope = 'git_repository';
  } catch {
    // Vercel uploads need not contain .git. Absence is not clean-source proof.
    revision = /^[a-f0-9]{40}$/.test(process.env.VERCEL_GIT_COMMIT_SHA ?? '') ? process.env.VERCEL_GIT_COMMIT_SHA : null;
    const excluded = new Set(['.git','node_modules','.next','.test-build','.vercel','.temp','coverage','build','out']);
    function walk(directory) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (excluded.has(entry.name) || entry.name.startsWith('.env') || entry.name === 'release.generated.json') continue;
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(file);
        else if (entry.isFile()) files.push(path.relative(root, file).replaceAll('\\','/'));
      }
    }
    walk(path.join(root, 'embodied-registry')); files.sort();
  }
  const tree = files.filter(file => fs.existsSync(path.join(root, file)) && fs.statSync(path.join(root, file)).isFile()).map(file => [file, fileDigest(path.join(root, file))]);
  const migrationPath = path.join(root, 'embodied-registry/supabase/migrations');
  return { format: 'knownrobot-release-receipt/1.0', revision, dirty, scope, digest_normalization: 'LF-normalized UTF-8 text; binary bytes unchanged',
    source_tree_sha256: sha256(JSON.stringify(tree)),
    web_version: JSON.parse(fs.readFileSync(path.join(root, 'embodied-registry/package.json'), 'utf8')).version,
    validator_version: fs.existsSync(path.join(root, 'pyproject.toml')) ? fs.readFileSync(path.join(root, 'pyproject.toml'), 'utf8').match(/^version = "([^"]+)"$/m)[1] : null,
    manifest_schema_sha256: fileDigest(path.join(root, 'embodied-registry/schema/robot-skill.schema.json')),
    migrations: fs.readdirSync(migrationPath).filter(file => file.endsWith('.sql')).sort().map(file => ({ file, sha256: fileDigest(path.join(migrationPath, file)) })),
    database_application: 'not_attested_by_build_receipt',
    limitations: 'A build-time source receipt, not a signed security attestation or proof of database migration, live sign-in, community activity or release approval.',
  };
}
function main() {
  const result = receipt();
  if (process.argv.includes('--require-clean') && (result.dirty !== false || result.scope !== 'git_repository')) throw Error('A verified clean Git checkout is required; unknown or dirty source cannot pass the release gate');
  if (process.argv.includes('--check')) {
    const built = JSON.parse(fs.readFileSync(path.join(root, 'embodied-registry/src/data/release.generated.json'), 'utf8'));
    if (JSON.stringify(built) !== JSON.stringify(result)) throw Error('Build receipt differs from current source; rebuild before release');
  } else fs.writeFileSync(path.join(root, 'embodied-registry/src/data/release.generated.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
}
if (require.main === module) main();
module.exports = { receipt };
