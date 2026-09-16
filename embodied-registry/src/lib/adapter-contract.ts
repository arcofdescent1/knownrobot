import { z } from "zod";
import { hash } from "./sprint-contract";
import { safeEvidenceUrl } from "./evidence-contract";
const text = z.string().trim().min(1).max(4000);
const handle = z.string().regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/);
const immutable = z.string().refine(value => {
  const url = safeEvidenceUrl(value);
  return !!url && new URL(url).hostname === "github.com" && /^\/[\w.-]+\/[\w.-]+\/blob\/[a-f0-9]{40}\/.+/.test(new URL(url).pathname);
}, "Use an immutable full-commit GitHub file link");
export const adapterSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/), name: text, robotFamily: text,
  repository: z.string().regex(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/), revision: z.string().regex(/^[a-f0-9]{40}$/),
  scope: text, limitations: text, license: text, tests: immutable, contract: immutable,
  supportIssue: z.string().regex(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/[1-9][0-9]*$/),
  updatedAt: z.iso.datetime({ offset: true }), expiresAt: z.iso.datetime({ offset: true }),
  status: z.enum(["active", "retired"]),
  maintainers: z.array(z.object({ handle, comment: z.string().regex(/^https:\/\/github\.com\/arcofdescent1\/knownrobot\/issues\/[1-9][0-9]*#issuecomment-[1-9][0-9]*$/), digest: z.string().regex(/^[a-f0-9]{64}$/) }).strict()).min(1).max(10),
}).strict().superRefine((value, ctx) => {
  if (Date.parse(value.expiresAt) <= Date.parse(value.updatedAt) || Date.parse(value.expiresAt) - Date.parse(value.updatedAt) > 90 * 86400000) ctx.addIssue({ code: "custom", message: "Ownership confirmations expire within 90 days" });
  if (new Set(value.maintainers.map(m => m.handle.toLowerCase())).size !== value.maintainers.length) ctx.addIssue({ code: "custom", message: "Maintainers must be distinct" });
});
export type Adapter = z.infer<typeof adapterSchema>;
export const adaptersSchema = z.array(adapterSchema).superRefine((values, ctx) => {
  if (new Set(values.map(v => v.id)).size !== values.length) ctx.addIssue({ code: "custom", message: "Adapter IDs must be unique" });
});
export function adapterDigest(a: Adapter) {
  const { maintainers, ...contract } = a;
  return hash({ ...contract, maintainers: maintainers.map(m => m.handle.toLowerCase()) });
}
export function adapterState(a: Adapter, now = new Date()) {
  if (a.maintainers.some(m => m.digest !== adapterDigest(a))) return "Unconfirmed ownership";
  if (a.status === "retired") return "Retired";
  return now < new Date(a.updatedAt) || now >= new Date(a.expiresAt) ? "Ownership confirmation not current" : "Maintainer-confirmed scope";
}
export async function verifyAdapter(a: Adapter, getComment: (id: string) => Promise<{ html_url: string; user: { login: string; type: string }; body: string }>) {
  const expected = adapterDigest(a);
  for (const m of a.maintainers) {
    if (m.digest !== expected) throw new Error(`Stale adapter consent: ${a.id}`);
    const actual = await getComment(m.comment.match(/#issuecomment-([0-9]+)$/)![1]);
    if (actual.html_url !== m.comment || actual.user?.type !== "User" || actual.user.login.toLowerCase() !== m.handle.toLowerCase() || !actual.body?.split(/\r?\n/).some(line => line.trim() === `KNOWNROBOT ADAPTER ${a.id} ${expected}`)) throw new Error(`Unverified adapter ownership: ${a.id}`);
  }
}
