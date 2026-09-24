const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { receipt, releaseSourceAccepted } = require('../scripts/release-receipt.cjs');
test('source-upload receipts preserve unknown cleanliness, exclude secrets and normalize text', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'knownrobot-release-test-'));
  const app = path.join(directory, 'embodied-registry');
  fs.mkdirSync(path.join(app,'schema'), { recursive:true });
  fs.mkdirSync(path.join(app,'supabase/migrations'), { recursive:true });
  fs.writeFileSync(path.join(app,'package.json'), '{"version":"1.0.0"}\n');
  fs.writeFileSync(path.join(app,'schema/robot-skill.schema.json'), '{}\n');
  fs.writeFileSync(path.join(app,'supabase/migrations/test.sql'), 'select 1;\n');
  try {
    const first = receipt(directory);
    assert.equal(first.scope, 'application_snapshot_without_git');
    assert.equal(first.dirty, null);
    assert.equal(first.database_application, 'not_attested_by_build_receipt');
    fs.writeFileSync(path.join(app,'.env.local'), 'SECRET=must-not-affect-receipt');
    fs.writeFileSync(path.join(app,'src-unused.bin'), Buffer.from([0,255,13,10]));
    const binary = receipt(directory);
    assert.notEqual(binary.source_tree_sha256, first.source_tree_sha256);
    fs.writeFileSync(path.join(app,'.env.local'), 'SECRET=changed');
    fs.writeFileSync(path.join(app,'supabase/migrations/test.sql'), 'select 1;\r\n');
    assert.equal(receipt(directory).source_tree_sha256, binary.source_tree_sha256);
    assert.ok(!JSON.stringify(receipt(directory)).includes('SECRET'));
  } finally {
    if (path.dirname(path.resolve(directory)) !== path.resolve(os.tmpdir())) throw Error('Unsafe test cleanup path');
    fs.rmSync(directory, { recursive:true, force:true });
  }
});

test('release gate accepts only clean Git or commit-bound Vercel source snapshots', () => {
  assert.equal(releaseSourceAccepted({ scope:'git_repository', dirty:false, revision:'a'.repeat(40) }, {}), true);
  assert.equal(releaseSourceAccepted({ scope:'git_repository', dirty:true, revision:'a'.repeat(40) }, {}), false);
  assert.equal(releaseSourceAccepted({ scope:'application_snapshot_without_git', dirty:null, revision:'a'.repeat(40) }, { VERCEL:'1' }), true);
  assert.equal(releaseSourceAccepted({ scope:'application_snapshot_without_git', dirty:null, revision:null }, { VERCEL:'1' }), false);
  assert.equal(releaseSourceAccepted({ scope:'application_snapshot_without_git', dirty:null, revision:'a'.repeat(40) }, {}), false);
});
