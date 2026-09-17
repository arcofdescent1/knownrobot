// Mechanical generation only. Hand-edit the Python package's canonical contract.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const names = ['robot-skill.schema.json', 'manifest-publication.rules.json'];
// Fail closed if a future schema starts using a validator keyword SQL has not
// implemented. Property names are not schema keywords.
const supported = new Set(['$schema','$id','title','type','additionalProperties','required','properties','const','enum','minLength','maxLength','pattern','format','items','maxItems','uniqueItems','minimum','exclusiveMinimum']);
function checkSpec(spec) {
  for (const key of Object.keys(spec)) if (!supported.has(key)) throw Error(`Unsupported database schema keyword: ${key}`);
  if (spec.format && !['date','uri'].includes(spec.format)) throw Error(`Unsupported database format: ${spec.format}`);
  for (const child of Object.values(spec.properties ?? {})) checkSpec(child);
  if (typeof spec.items === 'object') checkSpec(spec.items);
  if (typeof spec.additionalProperties === 'object') checkSpec(spec.additionalProperties);
}
checkSpec(JSON.parse(fs.readFileSync(path.join(root,'robot_skill/robot-skill.schema.json'),'utf8')));
for (const name of names) {
  const source = fs.readFileSync(path.join(root, 'robot_skill', name), 'utf8');
  const target = path.join(root, 'embodied-registry/schema', name);
  if (process.argv.includes('--check')) {
    if (fs.readFileSync(target, 'utf8') !== source) throw Error(`Contract drift: ${name}`);
  } else fs.writeFileSync(target, source);
}
const migration = path.join(root, 'embodied-registry/supabase/migrations/202609180002_manifest_contract.sql');
let sql = fs.readFileSync(migration, 'utf8');
for (const [tag, name] of [['manifest_schema','robot-skill.schema.json'], ['publication_rules','manifest-publication.rules.json']]) {
  const value = JSON.stringify(JSON.parse(fs.readFileSync(path.join(root,'robot_skill',name),'utf8')));
  const generated = `$${tag}$${value}$${tag}$`;
  const pattern = new RegExp(`\\$${tag}\\$[\\s\\S]*?\\$${tag}\\$`);
  if (!pattern.test(sql)) throw Error(`Missing migration contract delimiter: ${tag}`);
  if (process.argv.includes('--check')) {
    if (sql.match(pattern)[0] !== generated) throw Error(`Database contract drift: ${tag}`);
  } else sql = sql.replace(pattern, () => generated);
}
if (!process.argv.includes('--check')) fs.writeFileSync(migration, sql);
