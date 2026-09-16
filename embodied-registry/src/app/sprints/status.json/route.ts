import { sprint } from "@/lib/sprints";
import { sprintState, commitments } from "@/lib/sprint-contract";
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ sprint, state: sprintState(sprint), commitments: commitments(sprint) }, { headers: { "Cache-Control": "no-store" } });
}
