const sprint = require('../src/data/sprint-01.json');
const { sprintSchema } = require('../.test-build/src/lib/sprint-contract.js');
const { communityProof } = require('../.test-build/src/lib/community-proof.js');
const proof = communityProof(sprintSchema.parse(sprint));
console.log(JSON.stringify(proof, null, 2));
if (!proof.established) process.exitCode = 1;
