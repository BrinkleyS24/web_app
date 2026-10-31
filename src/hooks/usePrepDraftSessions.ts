import {useEffect,useRef,useState} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {loadPrepDrafts,removePrepDrafts,savePrepDrafts,PREP_DRAFT_TTL,type PrepSession} from "@/lib/prepDraftStorage";

/** Opt-in, tab-scoped recovery. No localStorage, server write or third-party request. */
export function usePrepDraftSessions(owner:string){
  const client=useQueryClient();
  const [restored]=useState(()=>loadPrepDrafts(owner));
  const [remember,setRemember]=useState(restored.remember),[storageError,setStorageError]=useState(restored.error);
  const enabled=useRef(remember),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const key=["outreach-draft-session",owner,"interview-prep"];
  const query=useQuery({queryKey:key,queryFn:()=>({} as Record<string,PrepSession>),initialData:()=>restored.sessions,enabled:false,gcTime:PREP_DRAFT_TTL});
  const expire=()=>{clearTimeout(timer.current);timer.current=setTimeout(()=>{
    try{removePrepDrafts(owner);}catch{/* The notice remains honest even if storage is blocked. */}
    enabled.current=false;setRemember(false);setStorageError("The tab recovery copy expired. Your open notes remain here; download them or enable recovery again.");
  },PREP_DRAFT_TTL);};
  useEffect(()=>{if(enabled.current)expire();return()=>clearTimeout(timer.current);},[]); // account owner remounts this hook
  function persist(sessions:Record<string,PrepSession>){
    try{savePrepDrafts(owner,sessions);setStorageError("");expire();}
    catch{
      try{removePrepDrafts(owner);}catch{/* Never replace usable in-memory work with a storage error. */}
      enabled.current=false;setRemember(false);clearTimeout(timer.current);
      setStorageError("The tab copy could not be saved. Your notes remain open. Download them before leaving or reloading.");
    }
  }
  function update(fn:(current:Record<string,PrepSession>)=>Record<string,PrepSession>){
    const current=client.getQueryData<Record<string,PrepSession>>(key)||{};const next=fn(current);
    client.setQueryData(key,next);if(enabled.current)persist(next);
  }
  function toggle(value:boolean){
    enabled.current=value;setRemember(value);
    if(value)persist(client.getQueryData<Record<string,PrepSession>>(key)||{});
    else{clearTimeout(timer.current);try{removePrepDrafts(owner);setStorageError("");}catch{setStorageError("Browser storage could not be cleared. Close this tab on a shared device.");}}
  }
  return [query.data,update,{remember,storageError,toggle}] as const;
}
