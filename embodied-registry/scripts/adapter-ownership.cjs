const fs = require("node:fs");
const path = require("node:path");
const { adaptersSchema, adapterDigest, verifyAdapter } = require("../.test-build/src/lib/adapter-contract.js");
async function main() {
  const adapters = adaptersSchema.parse(JSON.parse(fs.readFileSync(path.join(__dirname, "../src/data/adapters.json"), "utf8")));
  console.log(JSON.stringify(adapters.map(a => ({ id: a.id, digest: adapterDigest(a), token: `KNOWNROBOT ADAPTER ${a.id} ${adapterDigest(a)}` })), null, 2));
  for (const adapter of adapters) await verifyAdapter(adapter, async id => {
    const response = await fetch(`https://api.github.com/repos/arcofdescent1/knownrobot/issues/comments/${id}`, { signal: AbortSignal.timeout(15000), headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) } });
    if (!response.ok) throw new Error(`GitHub ownership verification unavailable (${response.status})`);
    return response.json();
  });
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
