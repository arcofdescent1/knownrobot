import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseClient } from "./lib/supabase/server";

// Check existence before loading.tsx streams a 200. Use only the public view:
// private records and missing records must remain indistinguishable.
export async function proxy(request: NextRequest) {
  const id = request.nextUrl.pathname.split("/")[2];
  if (id === "missing" || process.env.KNOWNROBOT_REGISTRY_MODE === "demo") return NextResponse.next();
  const missing = () => {
    const destination = request.nextUrl.clone();
    destination.pathname = "/evaluations/missing";
    destination.search = "";
    const response = NextResponse.rewrite(destination, { status: 404 });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Robots-Tag", "noindex, follow");
    return response;
  };
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id)) return missing();
  try {
    const client = getPublicSupabaseClient();
    if (!client) return NextResponse.next();
    const { data, error } = await client.from("public_registry_records").select("id").eq("id", id).maybeSingle().retry(false);
    // An outage is not evidence that a record does not exist.
    if (!error && !data) return missing();
  } catch { /* The page renders the existing honest unavailable state. */ }
  return NextResponse.next();
}

export const config = { matcher: ["/evaluations/:id"] };
