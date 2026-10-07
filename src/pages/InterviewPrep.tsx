import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader, Panel } from "@/components/premium/PremiumUI";
import { BUTTON } from "@/components/premium/tone";
import { useAuth } from "@/lib/AuthContext.jsx";
import { fetchResumeVariants } from "@/lib/emails";
import { readActionContext, type ActionContext } from "@/lib/actionWorkspace";
import { buildInterviewPractice, fetchInterviewSource, invitationScheduleLabel, splitFocusAreas, type PracticePack } from "@/lib/interviewPrep";
import { useDraftSession } from "@/hooks/useDraftSession";

type PrepSession = { variantId:string; posting:string; focus:string; pack?:PracticePack; builtInput?:string; notes:Record<string,string> };
const empty:PrepSession = {variantId:"",posting:"",focus:"",notes:{}};
const field="w-full min-w-0 rounded-xl border border-border bg-background p-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";
const noteFields = ["Situation", "My responsibility", "What I did", "Result and what I learned"];

export default function InterviewPrep() {
  const {user}=useAuth(); const location=useLocation(); const context=readActionContext(location.search);
  return <DashboardLayout><PageHeader eyebrow="Practice with your evidence" title="Interview preparation" description="Prepare truthful examples for this role, with the invitation and the resume you choose in view." />
    {context && user ? <PrepWorkspace key={`${user.uid}:${context.logicalKey}:${context.dedupeKey}`} context={context} owner={user.uid} />
      : <Panel className="mt-5"><p>Open an interview task from Next Actions to prepare for its exact conversation.</p><Link to="/next-actions" className={BUTTON.secondary}>Back to Next Actions</Link></Panel>}
  </DashboardLayout>;
}

function PrepWorkspace({context,owner}:{context:ActionContext;owner:string}) {
  const sessionKey=`${context.logicalKey}:${context.dedupeKey}`;
  const [sessions,updateSessions]=useDraftSession<PrepSession>("interview-prep");
  const session=sessions[sessionKey]||empty;
  const sessionRef=useRef(session); sessionRef.current=session;
  const update=(patch:Partial<PrepSession>)=>updateSessions(current=>({...current,[sessionKey]:{...(current[sessionKey]||empty),...patch}}));
  const [pending,setPending]=useState(false),[error,setError]=useState(""),[resetAllowed,setResetAllowed]=useState(false),[copied,setCopied]=useState("");
  const [focusNewPack,setFocusNewPack]=useState(false);
  const practiceRegion=useRef<HTMLDivElement>(null);
  const guard=useRef(false),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{if(focusNewPack&&session.pack){practiceRegion.current?.focus({preventScroll:true});practiceRegion.current?.scrollIntoView?.({block:"start",behavior:"smooth"});setFocusNewPack(false);}},[focusNewPack,session.pack]);
  const source=useQuery({queryKey:["interview-prep","source",owner,context.logicalKey,context.dedupeKey],queryFn:()=>fetchInterviewSource(context),retry:false,staleTime:0});
  const resumes=useQuery({queryKey:["interview-prep","resumes",owner],queryFn:async()=>{
    const response=await fetchResumeVariants();if(!response.success||!Array.isArray(response.variants))throw new Error("Your resumes could not be loaded.");return response.variants;
  },retry:false});
  const focuses=splitFocusAreas(session.focus);
  const inputValid=Boolean(session.variantId && resumes.data?.some(r=>r.id===session.variantId) && session.posting.trim().length>=100 && focuses.length>=1 && focuses.length<=5 && focuses.every(f=>f.length>=10&&f.length<=600));
  const hasNotes=Object.values(session.notes).some(note=>note.trim());
  const packStale=Boolean(session.pack && (session.pack.sourceVersion!==source.data?.sourceVersion || session.pack.resume.id!==session.variantId));
  // Store the inputs that actually generated a pack; typing later never silently changes its meaning.
  const builtInput=session.builtInput;
  const inputSignature=JSON.stringify([session.variantId,session.posting,session.focus]);
  const inputsChanged=Boolean(session.pack && builtInput!==inputSignature);
  const sourceAvailable=Boolean(source.data&&!source.isError&&!source.isFetching);
  async function generate() {
    if(guard.current||!inputValid||!sourceAvailable||(session.pack&&hasNotes&&!resetAllowed))return;
    guard.current=true;setPending(true);setError("");setCopied("");
    const snapshot=sessionRef.current;const signature=JSON.stringify([snapshot.variantId,snapshot.posting,snapshot.focus]);
    try {
      const pack=await buildInterviewPractice({...context,sourceVersion:source.data!.sourceVersion,variantId:snapshot.variantId,jobDescription:snapshot.posting,focusAreas:splitFocusAreas(snapshot.focus)});
      if(!mounted.current||JSON.stringify([sessionRef.current.variantId,sessionRef.current.posting,sessionRef.current.focus])!==signature)return;
      update({pack,builtInput:signature,notes:{}});setResetAllowed(false);setFocusNewPack(true);
    }catch(err){if(mounted.current)setError(err instanceof Error?err.message:"Practice could not be built. Your inputs remain here.");}
    finally{guard.current=false;if(mounted.current)setPending(false);}
  }
  function setNote(key:string,value:string){ updateSessions(current=>{const previous=current[sessionKey]||empty;return {...current,[sessionKey]:{...previous,notes:{...previous.notes,[key]:value}}};});setCopied(""); }
  async function copyNotes() {
    if(!session.pack||packStale||inputsChanged||!sourceAvailable)return;
    const text=session.pack.practice.map(item=>`${item.quote}\nPractice prompt: ${item.question}\n${item.kind==="eligibility"?`My current status: ${session.notes[`${item.id}:status`]||"Not written yet"}`:noteFields.map(label=>`${label}: ${session.notes[`${item.id}:${label}`]||"Not written yet"}`).join("\n")}\nQuestion to ask: ${item.askInterviewer}`).join("\n\n");
    try{await navigator.clipboard.writeText(text);if(mounted.current)setCopied("Practice notes copied. This did not mark the task done.");}
    catch{if(mounted.current)setCopied("Copy failed. Your notes are still here; select and copy them manually.");}
  }
  return <div className="mt-5 min-w-0 space-y-5 [overflow-wrap:anywhere]">
    <Panel title="1. Confirm the invitation">
      {source.isPending?<p role="status">Loading your interview source…</p>:source.isError?<><p role="alert">{source.error instanceof Error?source.error.message:"Your interview source could not be loaded."}</p><button className={BUTTON.secondary} onClick={()=>void source.refetch()}>Reload interview source</button></>:source.data?<>
        <p className="font-semibold">{[source.data.company,source.data.role].filter(Boolean).join(" · ")||"Interview conversation"}</p>
        <p className="mt-2 text-sm">{invitationScheduleLabel(source.data.schedule)}</p>
        <p className="mt-2 text-sm text-muted-foreground">Confirm the time, timezone, interview format and contact in the original invitation. These may change.</p>
        <a href={`https://mail.google.com/mail/u/0/#all/${encodeURIComponent(source.data.threadId)}`} target="_blank" rel="noreferrer" className={`${BUTTON.secondary} mt-3`}>Read invitation in Gmail</a>
        <details className="mt-3"><summary className="cursor-pointer text-sm font-medium">Invitation evidence</summary>{source.data.excerpts.map(email=><div key={email.id} className="mt-3 border-t border-border pt-3 text-sm"><p className="font-medium">{email.subject}</p><p className="text-muted-foreground">Invitation sender: {email.sender}</p><p className="mt-2 whitespace-pre-wrap">{email.text||"No readable message text; check Gmail."}</p></div>)}</details>
        <button className={`${BUTTON.secondary} mt-3`} disabled={source.isFetching||pending} onClick={()=>void source.refetch()}>Check for invitation changes</button>
      </>:null}
    </Panel>
    <Panel title="2. Choose what to practice" description="Use the resume you intend to discuss and the actual posting for this interview.">
      <div className="space-y-4">
        {resumes.isError?<><p role="alert">Your resumes could not be loaded. Your other inputs remain here.</p><button className={BUTTON.secondary} onClick={()=>void resumes.refetch()}>Reload resumes</button></>:null}
        <div><label htmlFor="prep-resume" className="block text-sm font-medium">Resume for this interview</label><select id="prep-resume" className={`${field} mt-1`} disabled={pending||resumes.isPending} value={session.variantId} onChange={e=>{update({variantId:e.target.value});setResetAllowed(false);}}><option value="">Choose a resume — no automatic selection</option>{resumes.data?.map(resume=><option key={resume.id} value={resume.id}>{resume.name}</option>)}</select>
          {resumes.data?.length===0?<p className="mt-2 text-sm">Add a readable resume before building your practice.</p>:null}<Link to="/resumes" className="mt-2 inline-block text-sm font-medium underline">Manage resumes</Link></div>
        <div><label htmlFor="prep-posting" className="block text-sm font-medium">Posting for this role</label><textarea id="prep-posting" className={`${field} mt-1 min-h-[160px]`} maxLength={25000} disabled={pending} value={session.posting} onChange={e=>{update({posting:e.target.value});setResetAllowed(false);}}/><p className="mt-1 text-xs text-muted-foreground">Paste the posting text, at least 100 characters. Confirm it is the role above; we have not linked a saved posting automatically.</p></div>
        <div><label htmlFor="prep-focus" className="block text-sm font-medium">Responsibilities or requirements to practice</label><textarea id="prep-focus" className={`${field} mt-1 min-h-[100px]`} maxLength={3004} disabled={pending} value={session.focus} onChange={e=>{update({focus:e.target.value});setResetAllowed(false);}}/><p className="mt-1 text-xs text-muted-foreground">Copy 1–5 exact quotes from this posting, one per line (10–600 characters each). Choose duties or qualifications, excluding headings and benefits.</p></div>
        {session.pack&&hasNotes?<label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={resetAllowed} disabled={pending} onChange={e=>setResetAllowed(e.target.checked)}/>I understand rebuilding replaces this practice and clears its rehearsal notes.</label>:null}
        <button className={BUTTON.primary} disabled={pending||!inputValid||!sourceAvailable||Boolean(session.pack&&hasNotes&&!resetAllowed)} onClick={()=>void generate()}>{pending?"Building practice…":session.pack?"Rebuild practice":"Build my practice"}</button>
        {error?<p role="alert" className="text-sm text-destructive">{error}</p>:null}
        <p className="text-xs text-muted-foreground">Inputs and rehearsal notes stay in memory in this tab for up to 30 minutes after leaving this page. Reloading or signing out clears them.</p>
      </div>
    </Panel>
    {session.pack?<div ref={practiceRegion} role="region" aria-label="Interview practice" tabIndex={-1} className="scroll-mt-20 outline-none"><Panel title="3. Rehearse your answers" description={`Using ${session.pack.resume.name}`}>
      {packStale||inputsChanged?<p role="alert" className="mb-3 text-sm text-warning">This practice uses an earlier invitation or earlier inputs. Review the source and rebuild before using it.</p>:null}
      <p className="mb-4 text-sm text-muted-foreground">{session.pack.disclosure}</p>
      <div className="space-y-5">{session.pack.practice.map(item=><section key={item.id} className="min-w-0 rounded-xl border border-border p-4">
        <p className="text-xs font-medium uppercase text-muted-foreground">From your posting</p><blockquote className="mt-1 text-sm font-semibold">{item.quote}</blockquote>
        <p className="mt-3 font-medium">{item.question}</p><p className="mt-2 text-sm text-muted-foreground">{item.guidance}</p>
        <details className="mt-3"><summary className="cursor-pointer text-sm font-medium">Possible examples from your selected resume</summary>{item.possibleExamples.length?item.possibleExamples.map((text,index)=><blockquote key={index} className="mt-2 whitespace-pre-wrap text-sm">{text}</blockquote>):<p className="mt-2 text-sm">No closely worded example was found. That does not establish a skill gap. Choose a truthful example from your own experience.</p>}</details>
        <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">{(item.kind==="eligibility"?["My current status"]:noteFields).map(label=>{const key=`${item.id}:${item.kind==="eligibility"?"status":label}`;return <div key={key}><label htmlFor={`prep-${key}`} className="block text-sm font-medium">{label}</label><textarea id={`prep-${key}`} className={`${field} mt-1 min-h-[90px]`} maxLength={2000} value={session.notes[key]||""} disabled={pending} onChange={e=>setNote(key,e.target.value)}/></div>;})}</div>
        <p className="mt-3 text-sm"><span className="font-medium">A question to ask: </span>{item.askInterviewer}</p>
      </section>)}</div>
      <p className="mt-4 text-sm">Say each answer aloud once. Check that it explains your own contribution and uses only facts you can support.</p>
      <button className={`${BUTTON.secondary} mt-3`} disabled={packStale||inputsChanged||!sourceAvailable} onClick={()=>void copyNotes()}>Copy practice notes</button>{copied?<p role="status" className="mt-2 text-sm">{copied}</p>:null}
      <p className="mt-3 text-xs text-muted-foreground">Building or editing practice does not mark the task done. Use the explicit task-completion button when you have finished.</p>
    </Panel></div>:null}
  </div>;
}
