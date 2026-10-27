import{readArtifact}from"@/lib/artifact-reader";
export async function GET(_:Request,{params}:{params:Promise<{slug:string}>}){const result=await readArtifact((await params).slug);return result?Response.json({schema:"knownrobot-artifact/1.0",...result},{headers:{"Cache-Control":"public, s-maxage=300","Access-Control-Allow-Origin":"*"}}):Response.json({error:"not_found"},{status:404});}
