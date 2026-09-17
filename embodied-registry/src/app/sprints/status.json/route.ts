import { sprint } from "@/lib/sprints";
import { sprintState, commitments } from "@/lib/sprint-contract";
import { communityProof } from "@/lib/community-proof";
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ sprint, state: sprintState(sprint), proof: communityProof(sprint), commitments: commitments(sprint) }, { headers: { "Cache-Control": "no-store" } });
}
