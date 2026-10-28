import type {ApplyGateQualificationAssessment} from '@/lib/emails';

const partNames:Record<string,string>={python:'Python',pytest:'Pytest',rust:'Rust',kotlin:'Kotlin',javascript:'JavaScript',typescript:'TypeScript',sql:'SQL',qa_years:'QA experience duration',test_ci:'Tests in CI/CD',github_actions:'GitHub Actions'};
const partName=(id:string)=>partNames[id]||id.replace(/_/g,' ');

export function QualificationEvidence({assessment}:{assessment:ApplyGateQualificationAssessment|null|undefined}){
 if(!assessment)return null;
 const heading=assessment.decision==='supported'?'Your resume supports the core requirements'
  :assessment.decision==='review'?'Core experience has support; some requirements need confirmation'
   :assessment.decision==='unavailable'?'Core qualification evidence could not be checked'
    :assessment.exclusionKind==='requirement_blocker'?'An explicit requirement blocks this application':'Core qualification evidence is incomplete';
 return <section className="min-w-0 rounded-lg border border-border bg-background p-3 text-sm" aria-label="Qualification evidence" data-testid="apply-gate-core-qualification">
  <p className="font-medium">{heading}</p>
  {assessment.decision!=='supported'&&<ul className="mt-2 list-disc pl-4 text-muted-foreground">{assessment.reasons.slice(0,3).map((reason,index)=><li className="break-words" key={index}>{reason}</li>)}</ul>}
  <p className="mt-1 text-xs text-muted-foreground">This check uses the selected resume. Missing evidence is different from not having a qualification; editing a resume cannot replace a mandatory degree or license.</p>
  {assessment.requirements.length>0&&<details className="mt-3">
   <summary className="cursor-pointer font-medium">Review requirement evidence</summary>
   <ul className="mt-3 space-y-3">
    {assessment.requirements.map((requirement,index)=>{
     const sources=requirement.evidenceSources?.length?requirement.evidenceSources.map(source=>source.quote):(requirement.evidence||'').split('\n').filter(Boolean);
     const status=requirement.status==='satisfied'?'Supported by this resume':requirement.status==='interview_assessment'?'Assessed during interviews':requirement.evidenceState==='explicitly_absent'?'Conflicts with the stated requirement':'The full requirement is not established';
     return <li key={index} className="min-w-0 space-y-1 border-l-2 border-border pl-3 [overflow-wrap:anywhere]">
      <p className="text-xs font-medium">{status}</p>
      <p className="font-medium">{requirement.label}</p>
      {requirement.quote?<div><p className="text-xs text-muted-foreground">Posting says</p><blockquote className="whitespace-pre-wrap">{requirement.quote}</blockquote></div>:<p className="text-xs text-muted-foreground">The requirement quotation is unavailable. Review the original posting.</p>}
      {!!requirement.components?.length&&<div className="space-y-1">
       <p className="text-xs text-muted-foreground">Recognized parts of this requirement. The full wording determines whether all parts or alternatives are needed.</p>
       <ul className="space-y-2">{requirement.components.map((part,i)=><li key={i}>
        <p className="font-medium">{partName(part.id)}: {part.status==='supported'?'Supported by this resume':part.status==='blocked'?'Conflicts with the stated requirement':'Not established by this resume'}</p>
        {part.evidenceSourceIndexes.map(index=>requirement.evidenceSources?.[index]).filter(source=>!!source).map((source,j)=><blockquote key={j} className="whitespace-pre-wrap text-xs text-muted-foreground">{source.quote}</blockquote>)}
       </li>)}</ul>
      </div>}
      {!requirement.components?.length&&(sources.length>0?<div><p className="text-xs text-muted-foreground">Resume evidence found{requirement.status!=='satisfied'?' — this does not establish the full requirement':''}</p><ul>{sources.map((quote,i)=><li key={i} className="whitespace-pre-wrap">{quote}</li>)}</ul></div>:<p className="text-xs text-muted-foreground">{requirement.status==='interview_assessment'?'This is an employer assessment, not a verified resume fact.':'Supporting evidence was not established in this resume.'}</p>)}
     </li>;
    })}
   </ul>
   {assessment.requirementsTruncated&&<p className="mt-2 text-xs text-muted-foreground">Showing {assessment.requirements.length} of {assessment.requirementCount} assessed requirements. Read the full posting before deciding.</p>}
  </details>}
 </section>;
}
