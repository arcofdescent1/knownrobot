export const policyFamilies = ["act", "smolvla", "pi0", "lerobot"] as const;
export const hardwareContexts = ["so101", "so100", "simulation", "undeclared"] as const;
export const evidenceStatuses = ["assessed", "measured", "needs-evidence", "reproduction-failure"] as const;
export type PolicyFamily = (typeof policyFamilies)[number];
export type HardwareContext = (typeof hardwareContexts)[number];
export type EvidenceStatus = (typeof evidenceStatuses)[number];
export type DiscoveryText = { title: string; summary?: string | null; source_repository?: string | null };
function corpus(record: DiscoveryText) { return `${record.title} ${record.summary ?? ""} ${record.source_repository ?? ""}`.toLowerCase(); }
export function inferPolicyFamily(record: DiscoveryText): PolicyFamily { const text=corpus(record); if(text.includes("smolvla"))return"smolvla";if(/(^|[^a-z])act([^a-z]|$)/.test(text))return"act";if(text.includes("pi0")||text.includes("π0")||text.includes("pi-0"))return"pi0";return"lerobot"; }
export function inferHardwareContexts(record: DiscoveryText): HardwareContext[] { const text=corpus(record),contexts:HardwareContext[]=[];if(/so[- ]?101/.test(text))contexts.push("so101");if(/so[- ]?100/.test(text))contexts.push("so100");if(/libero|pusht|simulation|benchmark/.test(text))contexts.push("simulation");return contexts.length?contexts:["undeclared"]; }
export function normalizeDiscoveryFilters(input:Record<string,string|string[]|undefined>){const one=(value:string|string[]|undefined)=>String(Array.isArray(value)?value[0]??"":value??"").trim(),family=one(input.family),hardware=one(input.hardware),evidence=one(input.evidence);return{q:one(input.q).slice(0,100),family:policyFamilies.includes(family as PolicyFamily)?family as PolicyFamily:undefined,hardware:hardwareContexts.includes(hardware as HardwareContext)?hardware as HardwareContext:undefined,evidence:evidenceStatuses.includes(evidence as EvidenceStatus)?evidence as EvidenceStatus:undefined,recent:one(input.sort)==="recent"};}
