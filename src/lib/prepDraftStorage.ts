import { isPracticePack, type PracticePack } from "./interviewPrep";

export type PrepSession = { variantId:string; posting:string; focus:string; pack?:PracticePack; builtInput?:string; builtFrom?:"invitation"|"posting"; notes:Record<string,string> };
const PREFIX="applendium:interview-prep:v1:";
export const PREP_DRAFT_TTL=30*60_000;
const MAX_CHARS=500_000;
export const emptyPrepSession:PrepSession={variantId:"",posting:"",focus:"",notes:{}};
const record=(v:unknown):v is Record<string,unknown>=>Boolean(v&&typeof v==="object"&&!Array.isArray(v));
function validSession(value:unknown):value is PrepSession {
  const v=value as PrepSession;
  return Boolean(record(v)&&typeof v.variantId==="string"&&v.variantId.length<=100&&typeof v.posting==="string"&&v.posting.length<=25_000
    &&typeof v.focus==="string"&&v.focus.length<=3004&&record(v.notes)&&Object.keys(v.notes).length<=20
    &&Object.entries(v.notes).every(([k,n])=>k.length<=100&&typeof n==="string"&&n.length<=2000)
    &&(v.builtInput===undefined||typeof v.builtInput==="string"&&v.builtInput.length<=35_000)
    &&(v.builtFrom===undefined||['invitation','posting'].includes(v.builtFrom))&&(v.pack===undefined||isPracticePack(v.pack)));
}
export function loadPrepDrafts(owner:string,now=Date.now()):{sessions:Record<string,PrepSession>;remember:boolean;error:string} {
  try{
    const raw=sessionStorage.getItem(PREFIX+owner);
    if(!raw)return {sessions:{},remember:false,error:""};
    const saved=raw.length<=MAX_CHARS?JSON.parse(raw):null;
    if(!record(saved)||saved.owner!==owner||saved.version!==1||typeof saved.expiresAt!=="number"||saved.expiresAt<=now||saved.expiresAt>now+PREP_DRAFT_TTL
      ||!record(saved.sessions)||Object.keys(saved.sessions).length>10||!Object.entries(saved.sessions).every(([k,v])=>/^(?:[a-f0-9]{16}:[a-f0-9]{16}|general|email:[1-9]\d{0,15})$/.test(k)&&validSession(v))){
      sessionStorage.removeItem(PREFIX+owner);return {sessions:{},remember:false,error:"The saved tab copy expired or could not be restored. Start fresh or use notes you downloaded."};
    }
    return {sessions:saved.sessions as Record<string,PrepSession>,remember:true,error:""};
  }catch{return {sessions:{},remember:false,error:"Tab recovery is unavailable in this browser. Download notes before leaving or reloading."};}
}
export function savePrepDrafts(owner:string,sessions:Record<string,PrepSession>,now=Date.now()) {
  if(!owner||Object.keys(sessions).length>10||!Object.values(sessions).every(validSession))throw new Error("Draft limit reached.");
  const raw=JSON.stringify({version:1,owner,expiresAt:now+PREP_DRAFT_TTL,sessions});
  if(raw.length>MAX_CHARS)throw new Error("Draft limit reached.");
  sessionStorage.setItem(PREFIX+owner,raw);
}
export function removePrepDrafts(owner:string){sessionStorage.removeItem(PREFIX+owner);}
/** Called only once authentication has resolved; loading a page must not clear its recovery copy. */
export function clearOtherPrepDrafts(owner:string|null){
  try{for(const key of Object.keys(sessionStorage))if(key.startsWith(PREFIX)&&key!==PREFIX+owner)sessionStorage.removeItem(key);}
  catch{/* Storage denial must never prevent authentication or logout. */}
}
