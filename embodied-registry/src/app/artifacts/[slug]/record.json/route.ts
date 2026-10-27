import{readArtifact}from"@/lib/artifact-reader";
const headers={"Cache-Control":"public, max-age=0, s-maxage=300, stale-while-revalidate=3600","X-Content-Type-Options":"nosniff"};
export async function GET(_:Request,{params}:{params:Promise<{slug:string}>}){const result=await readArtifact((await params).slug);if(!result)return Response.json({error:"not_found"},{status:404,headers});return Response.json({schema:"knownrobot-artifact/1.0",generated_at:new Date().toISOString(),...result},{headers});}
