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
  await api((request) => ({ body: request.url.includes('skill_id=') ? [] : [{ record: liveRecord() }] }), async (client, requests) => {
    const result = await readEvaluation(client, id);
    assert.equal(result.state, 'live'); assert.equal(result.record.id, id); assert.deepEqual(result.related, []);
    assert.equal(requests.length, 2);
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
