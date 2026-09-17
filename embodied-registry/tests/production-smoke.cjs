const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const { setTimeout: delay } = require('node:timers/promises');
const { demoRecord } = require('../.test-build/src/lib/demo-data.js');
const liveId = '40000000-0000-0000-0000-000000000001';
const liveRecord = structuredClone(demoRecord);
liveRecord.id = liveId;
liveRecord.skill.owner = { id: 'test-owner', kind: 'profile', name: 'Test registry publisher', handle: 'test-publisher' };
liveRecord.skill.manifest.attribution = [{ name: 'Test source author', role: 'policy-author', source_url: 'https://example.org/test-paper' }];

function tags(html, name) { return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map(match => Object.fromEntries([...match[0].matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], m[2].replaceAll('&amp;', '&')]))); }
async function metadataCheck(origin, path, index = true, status = 200) {
  const response = await fetch(origin + path, { headers: { 'User-Agent': 'Bingbot' } });
  assert.equal(response.status, status, path);
  const html = await response.text();
  const canonical = tags(html, 'link').filter(t => t.rel === 'canonical');
  assert.equal(canonical.length, 1, `${path}: one canonical`);
  assert.equal(new URL(canonical[0].href).href, new URL(path, 'https://knownrobot.com').href, path);
  const meta = tags(html, 'meta');
  assert.equal(new URL(meta.find(t => t.property === 'og:url')?.content).href, new URL(canonical[0].href).href, `${path}: matching social URL`);
  assert.equal(meta.find(t => t.name === 'twitter:title')?.content, meta.find(t => t.property === 'og:title')?.content, `${path}: matching social titles`);
  assert.ok(meta.some(t => t.name === 'robots' && (index ? /(?:^|, )index(?:,|$)/.test(t.content) && !t.content.includes('noindex') : t.content.includes('noindex'))), `${path}: index policy`);
  assert.ok(html.slice(0, html.indexOf('</head>')).includes('rel="canonical"'), `${path}: crawler head metadata`);
  return html;
}

async function withSite(env, check) {
  const reservation = http.createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '-p', String(port)], {
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_ANON_KEY: '', KNOWNROBOT_REGISTRY_MODE: '', ...env },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let diagnostics = '';
  child.stderr.on('data', data => { diagnostics = (diagnostics + data).slice(-1000); });
  const origin = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error('Production server exited: ' + diagnostics);
      try { await fetch(origin, { signal: AbortSignal.timeout(1000) }); ready = true; break; } catch { await delay(100); }
    }
    assert.ok(ready, 'Production server became ready');
    await check(origin);
  } finally {
    child.kill();
    if (child.exitCode === null) await new Promise(resolve => child.once('exit', resolve));
  }
}
async function main() {
  if (process.argv.includes('--preview')) {
    await withSite({ VERCEL_ENV: 'preview' }, async origin => {
      for (const path of ['/', '/thesis', '/validator', '/sprints', '/field-notes', '/field-notes/minimum-reproducibility-record', '/participate', '/adapters', '/corrections']) {
        await metadataCheck(origin, path, false);
        assert.match((await fetch(origin + path)).headers.get('x-robots-tag'), /noindex/);
      }
      const sitemap = await (await fetch(origin + '/sitemap.xml')).text();
      assert.ok(!sitemap.includes('<loc>'), 'Preview sitemap has no indexable destinations');
    });
    console.log('PASS: preview-built static/dynamic pages, noindex headers and empty sitemap');
    return;
  }
  await withSite({}, async origin => {
    await metadataCheck(origin, '/', false);
    for (const route of ['/thesis', '/validator', '/sprints', '/field-notes', '/participate', '/adapters', '/corrections', '/field-notes/five-reasons-policies-fail-to-transfer', '/field-notes/missing-from-policy-repositories', '/field-notes/minimum-reproducibility-record', '/field-notes/what-the-validator-cannot-infer']) await metadataCheck(origin, route);
    const missingNote = await fetch(origin + '/field-notes/nonexistent', { headers: { 'User-Agent': 'Bingbot' } });
    assert.equal(missingNote.status, 404); assert.ok((await missingNote.text()).includes('noindex'));
    const sitemap = await (await fetch(origin + '/sitemap.xml')).text();
    assert.ok(!sitemap.includes('<lastmod>')); assert.ok(!sitemap.includes('<loc>https://knownrobot.com/</loc>'));
    assert.ok(sitemap.includes('https://knownrobot.com/thesis')); assert.ok(!sitemap.includes('example-so101'));
    const robots = await (await fetch(origin + '/robots.txt')).text();
    assert.ok(robots.includes('Sitemap: https://knownrobot.com/sitemap.xml'));
    const html = await (await fetch(origin)).text();
    assert.ok(html.includes('Evidence collection is not connected yet'));
    assert.ok(!html.includes('Bimanual cable routing'));
    const download = await fetch(origin + '/evaluations/40000000-0000-0000-0000-000000000001/record.json');
    assert.equal(download.status, 503); assert.equal(download.headers.get('cache-control'), 'no-store');
    for (const exportPath of ['badge.svg', 'citation.json', 'credits.json']) {
      const exported = await fetch(`${origin}/evaluations/${liveId}/${exportPath}`);
      assert.equal(exported.status, 503); assert.match(exported.headers.get('x-robots-tag'), /noindex/);
    }
    const sprintPage = await fetch(origin + '/sprints');
    assert.equal(sprintPage.status, 200);
    const sprintHtml = await sprintPage.text();
    assert.ok(sprintHtml.includes('No teams have publicly confirmed participation yet'));
    assert.ok(sprintHtml.includes('No confirmed independent reviewers'));
    assert.ok(sprintHtml.includes('https://knownrobot.com/sprints'));
    const status = await fetch(origin + '/sprints/status.json');
    assert.equal(status.status, 200); assert.equal(status.headers.get('cache-control'), 'no-store');
    const operating = await status.json();
    assert.equal(operating.state.ready, false);
    assert.equal(operating.proof.established, false);
    assert.equal(operating.proof.confirmed_teams, 0);
    const receipt = await fetch(origin + '/release.json');
    assert.equal(receipt.status, 200);
    assert.equal(receipt.headers.get('cache-control'), 'no-store');
    assert.equal((await receipt.json()).format, 'knownrobot-release-receipt/1.0');
    assert.equal((await fetch(`${origin}/evaluations/${liveId}/compatibility.json?page=0`)).status, 400);
    const calendar = await fetch(origin + '/reproduction-sprints.ics');
    assert.equal(calendar.status, 200); assert.match(calendar.headers.get('content-type'), /text\/calendar/);
    assert.equal((await calendar.text()).match(/STATUS:TENTATIVE/g).length, 2);
    assert.ok((await (await fetch(origin + '/adapters')).text()).includes('No confirmed adapter owners yet'));
    assert.deepEqual((await (await fetch(origin + '/adapters/record.json')).json()).adapters, []);
    assert.ok((await (await fetch(origin + '/corrections')).text()).includes('Appeal without rewriting the past'));
  });
  console.log('PASS: unconfigured production pages and download status');
  await withSite({ KNOWNROBOT_REGISTRY_MODE: 'demo' }, async origin => {
    await metadataCheck(origin, '/', false);
    await metadataCheck(origin, '/evaluations/example-so101', false);
    const html = await (await fetch(origin)).text();
    assert.ok(html.includes('DEMONSTRATION ONLY'));
    assert.ok(html.includes('/evaluations/example-so101'));
    const detail = await (await fetch(origin + '/evaluations/example-so101')).text();
    for (const section of ['FICTIONAL FORMAT EXAMPLE', 'Evaluation protocol', 'Outcomes and failures', 'Review and correction history', 'Evidence artifacts']) assert.ok(detail.includes(section), section);
    assert.ok(detail.includes('noindex'));
    const download = await fetch(origin + '/evaluations/example-so101/record.json');
    assert.equal(download.status, 200); assert.equal(download.headers.get('cache-control'), 'no-store');
    assert.equal((await download.json()).illustrative, true);
    const manifest = await fetch(origin + '/evaluations/example-so101/manifest.json');
    assert.equal((await manifest.json()).schema_version, '1.0');
    assert.equal((await fetch(origin + '/evaluations/nonexistent/record.json')).status, 404);
    for (const exportPath of ['badge.svg', 'citation.json', 'credits.json', 'compatibility.json']) assert.equal((await fetch(`${origin}/evaluations/example-so101/${exportPath}`)).status, 404);
  });
  console.log('PASS: example detail pages, noindex, manifest, complete record, and missing IDs');
  const api = http.createServer((request, response) => {
    if (request.url.startsWith('/live/')) {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      if (request.url.includes('public_policy_attempts')) {
        response.end(JSON.stringify({ identity: { policy:'a'.repeat(64), hardware:'b'.repeat(64), protocol:'c'.repeat(64) }, page:1, total:0, records:[] }));
        return;
      }
      response.end(JSON.stringify(request.url.includes('public_registry_page') ? { total: 1, stats: { evaluations: 1, hardware: 1, contributors: 1 }, records: [liveRecord] } : request.url.includes('skill_id=') || !request.url.includes(liveId) ? [] : [{ record: liveRecord }]));
      return;
    }
    response.writeHead(request.url.includes('empty') ? 200 : 503, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(request.url.includes('empty')
      ? { total: 0, stats: { evaluations: 0, hardware: 0, contributors: 0 }, records: [] }
      : { message: 'Test-only simulated outage' }));
  });
  await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${api.address().port}`;
    await withSite({ NEXT_PUBLIC_SUPABASE_URL: url + '/live', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-public-key' }, async origin => {
      await metadataCheck(origin, '/');
      await metadataCheck(origin, '/?q=SO-101&status=reproduced&page=2', false);
      await metadataCheck(origin, `/evaluations/${liveId}`);
      const missingEvidence = await fetch(`${origin}/evaluations/40000000-0000-0000-0000-000000000099`, { headers: { 'User-Agent': 'Bingbot' } });
      assert.equal(missingEvidence.status, 404, 'Missing evaluation returns a crawler HTTP 404 before streaming');
      assert.ok((await missingEvidence.text()).includes('noindex'));
      const invalidEvidence = await fetch(`${origin}/evaluations/invalid-record`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      assert.equal(invalidEvidence.status, 404, 'Invalid identifiers return HTTP 404 for browsers too');
      const sitemap = await (await fetch(origin + '/sitemap.xml')).text();
      assert.ok(sitemap.includes(`<loc>https://knownrobot.com/evaluations/${liveId}</loc>`));
      assert.ok(!sitemap.includes('badge.svg')); assert.ok(!sitemap.includes('lastmod'));
      const page = await (await fetch(`${origin}/evaluations/${liveId}`)).text();
      assert.ok(page.includes('What does the evidence say for this configuration?'));
      const answerResponse = await fetch(`${origin}/evaluations/${liveId}/compatibility.json`);
      assert.equal(answerResponse.status, 200);
      const answer = await answerResponse.json();
      assert.equal(answer.format, 'knownrobot-compatibility-answer/1.0');
      assert.equal(answer.comparable_records_on_page, 0, 'Unknown execution and missing timeout are not comparable evidence');
      for (const section of ['Contribution credits', 'Test source author', 'Test registry publisher', 'CSL JSON', 'README / model-card badge']) assert.ok(page.includes(section), section);
      const badge = await fetch(`${origin}/evaluations/${liveId}/badge.svg`);
      assert.equal(badge.status, 200); assert.match(badge.headers.get('content-type'), /image\/svg\+xml/);
      assert.match(badge.headers.get('x-robots-tag'), /noindex/);
      assert.equal(badge.headers.get('cache-control'), 'no-store, max-age=0');
      assert.match(await badge.text(), /Self-reported/);
      for (const exportPath of ['badge.svg', 'citation.json', 'credits.json']) assert.equal((await fetch(`${origin}/evaluations/40000000-0000-0000-0000-000000000999/${exportPath}`)).status, 404);
      const csl = await (await fetch(`${origin}/evaluations/${liveId}/citation.json`)).json();
      assert.equal(csl[0].id, `https://knownrobot.com/evaluations/${liveId}`);
      const credits = await (await fetch(`${origin}/evaluations/${liveId}/credits.json`)).json();
      assert.equal(credits.declaredSourceContributors[0].name, 'Test source author');
      assert.equal(credits.publisher.name, 'Test registry publisher');
      assert.equal((await (await fetch(`${origin}/evaluations/${liveId}/record.json`)).json()).credits.format, 'knownrobot-credits/1.0');
      liveRecord.verification_status = 'reproduced'; liveRecord.evaluation.review_version = 1;
      liveRecord.reviews = [{ id: 'test-review', reviewer_id: 'test-reviewer', reviewer_identity: { id: 'test-reviewer', handle: 'test-reviewer', display_name: 'Test independent reviewer' }, previous_status: 'self_tested', new_status: 'reproduced', review_version: 1, rationale: 'Test-only current review', evidence_url: 'https://example.org/test-evidence', created_at: '2026-09-16T00:00:00Z', reviewed_snapshot: {} }];
      assert.match(await (await fetch(`${origin}/evaluations/${liveId}/badge.svg`)).text(), /Independently reproduced/);
      liveRecord.review_consistent = false;
      assert.match(await (await fetch(`${origin}/evaluations/${liveId}/badge.svg`)).text(), /Self-reported/);
    });
    console.log('PASS: live evidence badges, citations, author/publisher/reviewer credit and stale-review downgrade');
    await withSite({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-public-key' }, async origin => {
      const unavailableEvidence = await fetch(`${origin}/evaluations/${liveId}`, { headers: { 'User-Agent': 'Bingbot' } });
      assert.equal(unavailableEvidence.status, 200, 'Backend failure is not a fabricated missing-record response');
      assert.ok((await unavailableEvidence.text()).includes('Evidence temporarily unavailable'));
      const html = await (await fetch(origin)).text();
      assert.ok(html.includes('Evidence temporarily unavailable')); assert.ok(!html.includes('DEMONSTRATION ONLY'));
    });
    console.log('PASS: backend outage does not become fake evidence');
    await withSite({ NEXT_PUBLIC_SUPABASE_URL: url + '/empty', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-public-key' }, async origin => {
      const html = await (await fetch(origin)).text();
      assert.ok(html.includes('No public evidence yet')); assert.ok(!html.includes('DEMONSTRATION ONLY'));
    });
    console.log('PASS: genuine empty collection stays empty');
  } finally { api.closeAllConnections(); await new Promise(resolve => api.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
