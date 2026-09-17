const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createClient } = require('@supabase/supabase-js');
const { parseFilters, registryUrl, safeEvidenceUrl, displayStatus, registryPageSchema } = require('../.test-build/src/lib/evidence-contract.js');
const { readRegistry, readEvaluation } = require('../.test-build/src/lib/registry-reader.js');
const { demoRecord } = require('../.test-build/src/lib/demo-data.js');
const id = '40000000-0000-0000-0000-000000000001';
const liveRecord = () => ({ ...structuredClone(demoRecord), id });
const filters = { query: 'SO-101', status: '', page: 1 };
const { handleSchema, profileSchema, submissionSchema } = require('../.test-build/src/lib/identity-contract.js');
const { oneRelation } = require('../.test-build/src/lib/identity-reader.js');
const { manifestIssues } = require('../.test-build/src/lib/manifest-contract.js');
const { compatibilityAnswer } = require('../.test-build/src/lib/compatibility-answer.js');
test('compatibility answers separate execution, incomplete protocols, pages and review strength without pooling', () => {
  const anchor = liveRecord(); anchor.evaluation.runtime.execution = 'simulation';
  anchor.benchmark.protocol.timeout = 30;
  const other = structuredClone(anchor); other.id = 'other'; other.evaluation.success_rate = 0;
  const graph = { identity: { policy:'a'.repeat(64), hardware:'b'.repeat(64), protocol:'c'.repeat(64) }, page:1, total:1, records:[{ record:other, same_hardware:true, same_protocol:true }] };
  const answer = compatibilityAnswer(anchor, graph);
  assert.equal(answer.comparable_records_on_page, 2);
  assert.equal(answer.coverage_complete, true);
  assert.equal(answer.strength, 'self_reported_record_evidence');
  assert.equal(answer.distinct_submitter_accounts_on_page, 1);
  assert.equal(answer.evidence[1].reported_success_rate, 0);
  assert.equal('pooled_success_rate' in answer, false);
  graph.total = 100; assert.equal(compatibilityAnswer(anchor, graph).coverage_complete, false);
  other.evaluation.runtime.execution = 'physical'; assert.equal(compatibilityAnswer(anchor, graph).comparable_records_on_page, 1);
  other.evaluation.runtime.execution = 'simulation'; other.skill.manifest.dataset.revision = null;
  assert.equal(compatibilityAnswer(anchor, graph).comparable_records_on_page, 1);
  delete anchor.benchmark.protocol.timeout;
  assert.equal(compatibilityAnswer(anchor, graph).comparable_records_on_page, 0);
  assert.equal(compatibilityAnswer(anchor, null).strength, 'insufficient_complete_metadata');
});
test('shared manifest vectors agree on structural and publication levels', () => {
  const baseline = require('../schema/example.robot-skill.json');
  for (const vector of require('../../robot_skill/manifest-contract.cases.json')) {
    const value = structuredClone(baseline);
    for (const [path,replacement] of vector.changes) {
      const keys=path.split('.'); let target=value;
      for (const key of keys.slice(0,-1)) target=target[key];
      target[keys.at(-1)]=replacement;
    }
    assert.equal(!manifestIssues(value).length,vector.valid,vector.name);
    assert.equal(!manifestIssues(value,true).length,vector.complete,vector.name);
  }
});
test('native handles, links and relation shapes validate safely', () => {
  for (const handle of ['admin','knownrobot','support','system','../x','a','unsafe/name']) assert.equal(handleSchema.safeParse(handle).success,false);
  assert.equal(handleSchema.parse('My-Lab'),'my-lab');
  const profile = { handle:'test-builder',display_name:'Test Builder',bio:'',affiliation:'',github_url:'',huggingface_url:'' };
  assert.equal(profileSchema.safeParse(profile).success,true);
  for (const url of ['javascript:alert(1)','http://example.com','https://user:secret@example.com']) assert.equal(profileSchema.safeParse({...profile,github_url:url}).success,false);
  assert.deepEqual(oneRelation({slug:'test-team'}),{slug:'test-team'});
  assert.deepEqual(oneRelation([{slug:'test-team'}]),{slug:'test-team'});
  assert.equal(oneRelation([]),null);
});
test('evaluation submissions require real counts, immutable revisions and evidence', () => {
  const manifest = require('../schema/example.robot-skill.json');
  const payload = { name:'Test policy',summary:'A test fixture, never production evidence.',source_url:'https://example.com/policy',source_revision:'a'.repeat(40),framework:'ACT',license:'Apache-2.0',manifest:structuredClone(manifest),robot_family:'Test arm',configuration:{robot:'Test arm'},benchmark_name:'Test benchmark',benchmark_version:'1',protocol:{success:'Test predicate'},trial_count:10,success_count:3,runtime:{outcome:'test'},evidence:[{label:'Test evidence',url:'https://example.com/evidence'}],team_id:null };
  assert.equal(submissionSchema.safeParse(payload).success,true);
  for (const change of [{trial_count:0},{success_count:11},{source_revision:'main'},{evidence:[]},{manifest:{}},{source_url:'javascript:alert(1)'},{team_id:'not-a-team'}]) assert.equal(submissionSchema.safeParse({...payload,...change}).success,false);
  assert.equal(submissionSchema.parse({...payload,verification_status:'certified'}).verification_status,undefined);
  for (const artifact_path of [42,{},null,'../policy','a/../policy','/policy','a//policy','a\\policy','a/./policy','a policy']) assert.equal(submissionSchema.safeParse({...payload,manifest:{...manifest,artifact_path}}).success,false);
  assert.equal(submissionSchema.safeParse({...payload,manifest:{...manifest,artifact_path:'checkpoints/policy.safetensors'}}).success,true);
});
const { registryMetadata, pageMetadata } = require('../.test-build/src/lib/seo.js');

test('search-intent metadata preserves canonical and evidence indexing boundaries', () => {
  const previousEnv = process.env.VERCEL_ENV;
  try {
    process.env.VERCEL_ENV = 'production';
    const live = registryMetadata({ query: '', status: '', page: 1 }, 'live');
    assert.match(live.title, /LeRobot Policy Compatibility/);
    assert.match(live.description, /SO-101/);
    assert.equal(live.alternates.canonical, 'https://knownrobot.com/');
    assert.equal(live.robots.index, true);
    for (const state of ['demo', 'unavailable', 'unconfigured']) {
      assert.equal(registryMetadata({ query: '', status: '', page: 1 }, state).robots.index, false);
    }
    assert.equal(registryMetadata(filters, 'live').robots.index, false);
    assert.equal(registryMetadata({ query: '', status: '', page: 2 }, 'live').robots.index, false);
    process.env.VERCEL_ENV = 'preview';
    assert.equal(registryMetadata({ query: '', status: '', page: 1 }, 'live').robots.index, false);
    assert.equal(pageMetadata('/validator', 'Validator', 'Guide').robots.index, false);
  } finally {
    if (previousEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousEnv;
  }
});

async function api(reply, fn) {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    requests.push({ url: request.url, body: body ? JSON.parse(body) : null });
    const answer = reply(request, requests.at(-1));
    response.writeHead(answer.status ?? 200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(answer.body));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const client = createClient(`http://127.0.0.1:${server.address().port}`, 'test-public-key', { auth: { persistSession: false } });
    await fn(client, requests);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

test('filters sanitize input and pagination preserves global search', () => {
  assert.deepEqual(parseFilters({ q: ' SO-101 ', status: 'forged', page: 'NaN' }), filters);
  assert.equal(registryUrl({ query: 'A&B', status: 'reproduced', page: 2 }), '/?q=A%26B&status=reproduced&page=2');
  assert.equal(parseFilters({ page: '-1', q: 'x'.repeat(250) }).query.length, 200);
});
test('unsafe evidence URLs cannot become executable links', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,x', 'http://example.com', 'https://user:secret@example.com', '../private', null]) assert.equal(safeEvidenceUrl(value), null);
  assert.equal(safeEvidenceUrl('https://example.com/evidence'), 'https://example.com/evidence');
});
test('strong trust labels require an attributable matching decision', () => {
  const record = liveRecord(); record.verification_status = 'reproduced';
  assert.equal(displayStatus(record), 'self_tested');
  record.evaluation.review_version = 1;
  record.reviews = [{ review_version: 1, new_status: 'reproduced' }];
  assert.equal(displayStatus(record), 'reproduced');
  record.review_consistent = false;
  assert.equal(displayStatus(record), 'self_tested');
});
test('null success rate is not silently converted to zero', () => {
  const record = liveRecord(); record.evaluation.success_rate = null;
  assert.equal(registryPageSchema.parse({ total: 1, stats: { evaluations: 1, hardware: 1, contributors: 1 }, records: [record] }).records[0].evaluation.success_rate, null);
});
test('genuine empty database remains live and empty', async () => {
  await api(() => ({ body: { total: 0, stats: { evaluations: 0, hardware: 0, contributors: 0 }, records: [] } }), async (client, requests) => {
    const result = await readRegistry(client, filters);
    assert.equal(result.state, 'live'); assert.deepEqual(result.data.records, []);
    assert.deepEqual(requests[0].body, { p_query: 'SO-101', p_status: '', p_page: 1 });
  });
});
test('outages and malformed payloads never become examples', async () => {
  for (const answer of [{ status: 503, body: { message: 'database unavailable' } }, { body: { records: [{ fake: true }] } }]) {
    await api(() => answer, async client => { const result = await readRegistry(client, filters); assert.equal(result.state, 'unavailable'); assert.deepEqual(result.data.records, []); });
  }
});
test('detail pages read a public record and related attempts', async () => {
  await api((request) => ({ body: request.url.includes('/rpc/public_policy_attempts') ? {identity:{policy:'a'.repeat(64),hardware:'b'.repeat(64),protocol:'c'.repeat(64)},page:1,total:0,records:[]} : [{ record: liveRecord() }] }), async (client, requests) => {
    const result = await readEvaluation(client, id);
    assert.equal(result.state, 'live'); assert.equal(result.record.id, id); assert.deepEqual(result.related, []);
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[1].body,{p_id:id,p_page:1});
    assert.equal(result.graph.identity.policy,'a'.repeat(64));
  });
});
test('graph reads connect different owned skill IDs and preserve failed outcomes', async () => {
  const other = liveRecord(); other.id='40000000-0000-0000-0000-000000000002'; other.skill.id='different-owned-snapshot'; other.evaluation.success_rate=0;
  await api(request => ({body: request.url.includes('/rpc/') ? {identity:{policy:'a'.repeat(64),hardware:null,protocol:null},page:2,total:31,records:[{record:other,same_hardware:false,same_protocol:true}]} : [{record:liveRecord()}]}), async (client, requests) => {
    const result=await readEvaluation(client,id,2);
    assert.equal(result.state,'live'); assert.equal(result.related[0].skill.id,'different-owned-snapshot'); assert.equal(result.related[0].evaluation.success_rate,0);
    assert.equal(result.graph.records[0].same_hardware,false); assert.equal(result.graph.records[0].same_protocol,true);
    assert.deepEqual(requests[1].body,{p_id:id,p_page:2});
  });
});
test('graph outages and malformed identities fail closed', async () => {
  for (const body of [null,{}, {identity:{policy:'forged',hardware:null,protocol:null},page:1,total:0,records:[]}]) {
    await api(request => ({body:request.url.includes('/rpc/') ? body : [{record:liveRecord()}]}),async client=>assert.equal((await readEvaluation(client,id)).state,'unavailable'));
  }
  await api(()=>({body:[]}),async (client,requests)=>{
    for (const page of [0,-1,1.5,100001,NaN]) assert.equal((await readEvaluation(client,id,page)).state,'unavailable');
    assert.equal(requests.length,0);
  });
});
test('missing, private, and invalid identifiers are not disclosed', async () => {
  await api(() => ({ body: [] }), async (client, requests) => {
    assert.equal((await readEvaluation(client, 'not-an-id')).state, 'missing'); assert.equal(requests.length, 0);
    assert.equal((await readEvaluation(client, id)).state, 'missing');
  });
});
test('detail backend failure is unavailable, not a fabricated 404', async () => {
  await api(() => ({ status: 503, body: { message: 'unavailable' } }), async client => assert.equal((await readEvaluation(client, id)).state, 'unavailable'));
});
