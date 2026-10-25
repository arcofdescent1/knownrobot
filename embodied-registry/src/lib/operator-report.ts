import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const count = z.number().int().nonnegative();

export const accountActivitySummarySchema = z.object({
  as_of: z.string().datetime({ offset: true }),
  definition: z.string().min(1).max(500),
  verified_accounts: count,
  activated_accounts: count,
  active_accounts_30d: count,
  retained_accounts_7d: count,
  retained_accounts_30d: count,
  excluded_accounts: count,
  qualifying_events_30d: count,
  channels_30d: z.record(z.string(), count),
});

export type AccountActivitySummary = z.infer<
  typeof accountActivitySummarySchema
>;

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

export function reportingTokenAccepted(
  authorization: string | null,
  expected: string | undefined,
) {
  if (!expected || expected.length < 32 || !authorization?.startsWith("Bearer "))
    return false;
  const supplied = authorization.slice(7);
  return supplied.length >= 32 && timingSafeEqual(digest(supplied), digest(expected));
}

export function privacySafeAccountSummary(
  summary: AccountActivitySummary,
  minimumChannelCohort = 5,
) {
  const channels = Object.fromEntries(
    Object.entries(summary.channels_30d).map(([channel, total]) => [
      channel,
      total < minimumChannelCohort ? null : total,
    ]),
  );
  return {
    format: "knownrobot-marketing-summary/1.0",
    ...summary,
    channels_30d: channels,
    channel_suppression_threshold: minimumChannelCohort,
    privacy:
      "Aggregate account lifecycle counts only; no account rows, email addresses, profile fields, evidence payloads, IP addresses, device identifiers or analytics identifiers.",
  };
}
