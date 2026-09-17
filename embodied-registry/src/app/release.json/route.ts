import receipt from "@/data/release.generated.json";
export function GET() {
  return Response.json(receipt, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex" } });
}
