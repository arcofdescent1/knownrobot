export type QualityItem={id:string;label:string;description:string;complete:boolean;action:string;href:string};
type Input={artifact:{slug:string;summary:string;license:string;artifact_type:string;source_url:string};revisions:Array<{source_revision:string}>;claims:Array<unknown>;contributions:Array<{kind:string;payload?:Record<string,unknown>}>;attempts:Array<Record<string,unknown>>;placements:Array<unknown>};
export function artifactQuality(input:Input){
  const reproduction=input.attempts.some(raw=>String(raw.relationship)==="reproduction");
  const evidence=input.attempts.length>0;
  const reviewed=input.contributions.some(item=>item.kind==="review");
  const maintainerReviewed=input.contributions.some(item=>item.kind==="review"&&item.payload?.authority==="maintainer");
  const items:QualityItem[]=[
    {id:"provenance",label:"Public provenance",description:"Canonical upstream source is linked.",complete:/^https:\/\/(github\.com|huggingface\.co)\//.test(input.artifact.source_url),action:"Inspect source",href:input.artifact.source_url},
    {id:"revision",label:"Immutable revision",description:"Metadata is pinned to an immutable source revision.",complete:input.revisions.some(item=>/^[a-f0-9]{40,64}$/i.test(item.source_revision)),action:"Inspect history",href:`/artifacts/${input.artifact.slug}?tab=history`},
    {id:"metadata",label:"Core metadata",description:"Type, summary, and license are present.",complete:Boolean(input.artifact.artifact_type&&input.artifact.summary&&input.artifact.license),action:"Review metadata",href:`/opportunities/review/${input.artifact.slug}`},
    {id:"community_review",label:"Community review",description:"A contributor confirmed, corrected, or challenged a field with a source.",complete:reviewed,action:"Review one field",href:`/opportunities/review/${input.artifact.slug}`},
    {id:"maintainer_review",label:"Maintainer review",description:"A repository-verified maintainer reviewed the record.",complete:maintainerReviewed,action:input.claims.length?"Review as maintainer":"Claim as maintainer",href:input.claims.length?`/opportunities/review/${input.artifact.slug}`:`/artifacts/${input.artifact.slug}#maintainer`},
    {id:"evidence",label:"Observed evidence",description:"At least one published attempt is attached.",complete:evidence,action:"Add evidence",href:`/artifacts/${input.artifact.slug}?tab=evidence#add-evidence`},
    {id:"reproduction",label:"Independent reproduction",description:"A separately attributed reproduction attempt is attached.",complete:reproduction,action:"Request or add reproduction",href:`/artifacts/${input.artifact.slug}?tab=discussions#start-discussion`},
    {id:"distribution",label:"Upstream distribution",description:"A public repository, model card, or external resource links to this record.",complete:input.placements.length>0,action:"Add an integration",href:`/artifacts/${input.artifact.slug}?tab=distribution#register-placement`},
  ];
  return{items,complete:items.filter(item=>item.complete).length,total:items.length,percent:Math.round(items.filter(item=>item.complete).length/items.length*100),next:items.find(item=>!item.complete)||null};
}
