import { readViewerShell } from "@/lib/viewer-shell";
export const dynamic = "force-dynamic";
export async function GET() { return Response.json({ viewer: await readViewerShell() }, { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } }); }
