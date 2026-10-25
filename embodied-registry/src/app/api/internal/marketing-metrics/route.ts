import { createClient } from "@supabase/supabase-js";
import {
  accountActivitySummarySchema,
  privacySafeAccountSummary,
  reportingTokenAccepted,
} from "@/lib/operator-report";

export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export async function GET(request: Request) {
  if (
    !reportingTokenAccepted(
      request.headers.get("authorization"),
      process.env.KNOWNROBOT_REPORTING_TOKEN,
    )
  )
    return Response.json(
      { error: "Not authorized." },
      { status: 401, headers: { ...responseHeaders, "WWW-Authenticate": "Bearer" } },
    );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    return Response.json(
      { error: "Reporting service is unavailable." },
      { status: 503, headers: responseHeaders },
    );

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        }),
    },
  });
  const { data, error } = await client.rpc("operator_account_activity_summary", {
    p_as_of: new Date().toISOString(),
  });
  const parsed = accountActivitySummarySchema.safeParse(data);
  if (error || !parsed.success)
    return Response.json(
      { error: "Reporting service is unavailable." },
      { status: 503, headers: responseHeaders },
    );
  return Response.json(privacySafeAccountSummary(parsed.data), {
    headers: responseHeaders,
  });
}
