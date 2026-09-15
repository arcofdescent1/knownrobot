import schema from "../../../../../schema/robot-skill.schema.json";

export function GET() {
  return Response.json(schema, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, immutable",
    },
  });
}
