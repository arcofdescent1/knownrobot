import { adapters } from "@/lib/adapters";
import { adapterState } from "@/lib/adapter-contract";
export const dynamic = "force-dynamic";
export function GET() { return Response.json({ format: "knownrobot-adapters/1.0", adapters: adapters.map(a => ({ ...a, currentState: adapterState(a) })) }, { headers: { "Cache-Control": "no-store" } }); }
