import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";
import InterviewPrep from "./InterviewPrep";
const mocks=vi.hoisted(()=>({auth:vi.fn(),source:vi.fn(),variants:vi.fn(),build:vi.fn(),stored:vi.fn(),queue:vi.fn(),history:vi.fn()}));
vi.mock("@/lib/AuthContext.jsx",()=>({useAuth:()=>mocks.auth()}));
// The banner has its own tests; here it is a marker so its position under the heading is checked.
vi.mock("@/components/premium/ActionWorkspaceBanner",()=>({ActionWorkspaceBanner:()=><section aria-label="Action context">Task card</section>}));
vi.mock("@/components/DashboardLayout",()=>({DashboardLayout:({children}:{children:React.ReactNode})=><div>{children}</div>}));
vi.mock("@/lib/emails",()=>({fetchApplyGateHistory:()=>mocks.history(),fetchResumeVariants:()=>mocks.variants(),fetchStoredEmails:()=>mocks.stored(),fetchRankedActionQueue:()=>mocks.queue()}));
vi.mock("@/lib/interviewPrep",async()=>({...await vi.importActual("@/lib/interviewPrep"),fetchInterviewSource:(...args:unknown[])=>mocks.source(...args),buildInterviewPractice:(...args:unknown[])=>mocks.build(...args)}));
const logicalKey="0123456789abcdef",dedupeKey="fedcba9876543210",variantId="aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const quote="Manage appointment scheduling and patient records.";
const posting=`Receptionist responsibilities at Example Health. ${quote} Maintain accurate information and support patients and visitors throughout the day.`;
const source={logicalKey,dedupeKey,sourceVersion:"a".repeat(64),company:"Example Health",role:"Receptionist",threadId:"thread",schedule:null,excerpts:[{id:"1",subject:"Invitation",sender:"Recruiter",text:"Interview at the clinic.",receivedAt:null}]};
const pack={sourceVersion:source.sourceVersion,resume:{id:variantId,name:"Front desk",version:"b".repeat(64)},postingVersion:"c".repeat(64),disclosure:"Practice prompts, not predictions of interview questions.",practice:[{id:"focus-one",quote,kind:"experience",question:"Walk through a real example.",guidance:"Only facts you can support.",askInterviewer:"How is success measured?",possibleExamples:["Managed appointment scheduling and patient records for a clinic."]}]};
beforeEach(()=>{sessionStorage.clear();vi.clearAllMocks();mocks.auth.mockReturnValue({user:{uid:"owner"}});mocks.source.mockResolvedValue(source);mocks.variants.mockResolvedValue({success:true,variants:[{id:variantId,name:"Front desk",isDefault:true},{id:"ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee",name:"Other version"}]});mocks.build.mockResolvedValue(pack);mocks.history.mockResolvedValue({success:true,history:[]});mocks.stored.mockResolvedValue({success:true,emails:[]});mocks.queue.mockResolvedValue({success:true,queue:{doToday:[],thisWeek:[],later:[],blocked:[]}});});
function setup(client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}}),path=`/interview-prep?action=${logicalKey}&version=${dedupeKey}`){const ui=<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><InterviewPrep/></MemoryRouter></QueryClientProvider>;return {...render(ui),client,ui};}
// The source setup represents pasting a posting and its exact focus quote.
// Keep actual typing in the note-editing cases rather than replaying hundreds of
// setup keystrokes in every unrelated regression.
async function fill(){await screen.findByText("Example Health · Receptionist");await userEvent.selectOptions(screen.getByLabelText("Resume for this interview"),variantId);fireEvent.change(screen.getByLabelText("Posting for this role"),{target:{value:posting}});fireEvent.change(screen.getByLabelText("Responsibilities or requirements to practice"),{target:{value:quote}});}
async function build(){await userEvent.click(screen.getByRole("button",{name:"Build my practice"}));await screen.findByText("Walk through a real example.");}
// 2026-10-15: prep starts in one tap, so the default resume is preselected (it used to require an
// explicit choice). A thin invitation with no posting still builds nothing, and no time is guessed.
test("the default resume is preselected and named; a thin invitation with no posting builds nothing",async()=>{setup();await screen.findByText("Example Health · Receptionist");await waitFor(()=>expect(screen.getByLabelText("Resume for this interview")).toHaveValue(variantId));expect(screen.getByTestId("prep-resume-why")).toHaveTextContent("Picked: your default resume");expect(screen.getByTestId("prep-basis")).toHaveTextContent("The invitation is too short to practice from");expect(screen.getByRole("button",{name:"Build my practice"})).toBeDisabled();expect(screen.getByText(/Date and time are unconfirmed/)).toBeInTheDocument();expect(mocks.build).not.toHaveBeenCalled();});
test("build carries the exact task, invitation version, posting and selected resume",async()=>{setup();await fill();await build();expect(mocks.build).toHaveBeenCalledWith({logicalKey,dedupeKey,sourceVersion:source.sourceVersion,variantId,jobDescription:posting,focusAreas:[quote]},{signal:expect.any(AbortSignal)});expect(screen.getByText(pack.disclosure)).toBeInTheDocument();await userEvent.click(screen.getByText("Possible examples from your selected resume"));expect(screen.getByText(pack.practice[0].possibleExamples[0])).toBeInTheDocument();});
test("inputs, pack and rehearsal notes survive navigation without silently rebuilding",async()=>{const page=setup();await fill();await build();await userEvent.type(screen.getByLabelText("What I did"),"I confirmed each appointment and updated the records.");page.unmount();setup(page.client);expect(await screen.findByLabelText("What I did")).toHaveValue("I confirmed each appointment and updated the records.");expect(screen.getByLabelText("Posting for this role")).toHaveValue(posting);expect(mocks.build).toHaveBeenCalledTimes(1);});
test("rebuilding cannot discard written notes without explicit reset acknowledgement",async()=>{setup();await fill();await build();await userEvent.type(screen.getByLabelText("Situation"),"A busy clinic morning.");await userEvent.click(screen.getByText("Review source, change setup or enable tab recovery"));const rebuild=screen.getByRole("button",{name:"Rebuild practice"});expect(rebuild).toBeDisabled();await userEvent.click(screen.getByLabelText(/I understand rebuilding replaces/));expect(rebuild).toBeEnabled();await userEvent.click(rebuild);await waitFor(()=>expect(screen.getByLabelText("Situation")).toHaveValue(""));});
test("new invitation fingerprint makes old practice unavailable for copying while retaining notes",async()=>{setup();await fill();await build();await userEvent.type(screen.getByLabelText("What I did"),"My actual contribution.");mocks.source.mockResolvedValue({...source,sourceVersion:"d".repeat(64)});await userEvent.click(screen.getByText("Review source, change setup or enable tab recovery"));await userEvent.click(screen.getByRole("button",{name:"Check for invitation changes"}));expect(await screen.findByRole("alert")).toHaveTextContent(/earlier invitation/);expect(screen.getByRole("button",{name:"Copy practice notes"})).toBeDisabled();expect(screen.getByLabelText("What I did")).toHaveValue("My actual contribution.");});
test("source outage preserves inputs and blocks practice until verified",async()=>{mocks.source.mockRejectedValue(new Error("Interview source unavailable."));setup();expect(await screen.findByRole("alert")).toHaveTextContent("Interview source unavailable.");await userEvent.type(screen.getByLabelText("Posting for this role"),posting);await userEvent.click(screen.getByRole("button",{name:"Reload interview source"}));expect(screen.getByLabelText("Posting for this role")).toHaveValue(posting);expect(screen.getByRole("button",{name:"Build my practice"})).toBeDisabled();});
test("failed generation retains inputs and never claims practice exists",async()=>{mocks.build.mockRejectedValue(new Error("The invitation changed."));setup();await fill();await userEvent.click(screen.getByRole("button",{name:"Build my practice"}));expect(await screen.findByRole("alert")).toHaveTextContent("The invitation changed.");expect(screen.getByLabelText("Posting for this role")).toHaveValue(posting);expect(screen.queryByText("Walk through a real example.")).not.toBeInTheDocument();});
test("late generation after leaving cannot cache a pack",async()=>{let finish:(value:unknown)=>void;mocks.build.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));const page=setup();await fill();await userEvent.click(screen.getByRole("button",{name:"Build my practice"}));await waitFor(()=>expect(mocks.build).toHaveBeenCalled());page.unmount();finish!(pack);await new Promise(resolve=>setTimeout(resolve,0));const cache=page.client.getQueryData<Record<string,{pack?:unknown}>>(["outreach-draft-session","owner","interview-prep"]);expect(cache?.[`${logicalKey}:${dedupeKey}`]?.pack).toBeUndefined();});
test("account switch does not expose another account's posting or notes",async()=>{const page=setup();await fill();await build();await userEvent.type(screen.getByLabelText("Situation"),"Owner private notes.");mocks.auth.mockReturnValue({user:{uid:"other-owner"}});page.rerender(<QueryClientProvider client={page.client}><MemoryRouter><InterviewPrep/></MemoryRouter></QueryClientProvider>);await waitFor(()=>expect(screen.getByLabelText("Posting for this role")).toHaveValue(""));expect(screen.queryByText("Walk through a real example.")).not.toBeInTheDocument();});
test("copy uses the user's actual notes; clipboard failure keeps them editable",async()=>{setup();await fill();await build();await userEvent.type(screen.getByLabelText("What I did"),"I verified appointment times.");const writeText=vi.fn().mockResolvedValue(undefined);Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText}});fireEvent.click(screen.getByRole("button",{name:"Copy practice notes"}));await waitFor(()=>expect(writeText).toHaveBeenCalledWith(expect.stringContaining("What I did: I verified appointment times.")));expect(await screen.findByText(/Practice notes copied/)).toBeInTheDocument();writeText.mockRejectedValue(new Error("Blocked clipboard"));fireEvent.click(screen.getByRole("button",{name:"Copy practice notes"}));expect(await screen.findByText(/Copy failed/)).toBeInTheDocument();expect(screen.getByLabelText("What I did")).toHaveValue("I verified appointment times.");});
test("missing action keys do not request any interview source or resume data",async()=>{setup(undefined,"/interview-prep");expect(await screen.findByText("No live interviews right now")).toBeInTheDocument();expect(mocks.source).not.toHaveBeenCalled();expect(mocks.variants).not.toHaveBeenCalled();});
// /interview-prep dead-ended at "Open an interview task from Next Actions" (persona review, 2026-10-14).
const recent=new Date(Date.now()-3*86_400_000).toISOString();
const interviewEmail=(over:Record<string,unknown>)=>({id:"101",thread_id:"t-q",category:"Interviewed",company_name:"Quillstone Learning",position:"Curriculum Developer",date:recent,applicationId:"app-q",...over});
const prepAction={id:"prep-1",logicalKey,dedupeKey,primaryEntityId:"t-q",actionType:"prep_interview",actionCategory:"preparation",intent:"PREP_INTERVIEW",intentLabel:"Interview prep",sourceLabel:"Interview",stageLabel:"Interview",routeHref:"/interview-prep",routeLabel:"Prepare",draftEligible:false,title:"Prepare for Quillstone",urgencyLevel:"high",confidenceLevel:"strong",status:"open",effectiveStatus:"open",queueSource:"followup",createdAt:recent,evidence:[],playbook:[],company:"Quillstone Learning",threadId:"t-q",applicationId:"app-q"};
test("lists live interviews with a way into the matching prep task",async()=>{mocks.stored.mockResolvedValue({success:true,emails:[interviewEmail({})]});mocks.queue.mockResolvedValue({success:true,queue:{doToday:[prepAction],thisWeek:[],later:[],blocked:[]}});setup(undefined,"/interview-prep");const link=await screen.findByRole("link",{name:"Prepare for this interview"});expect(link).toHaveAttribute("href",`/interview-prep?action=${logicalKey}&version=${dedupeKey}`);expect(screen.getByText("Quillstone Learning · Curriculum Developer")).toBeInTheDocument();});
test("a live interview without a task opens its exact invitation",async()=>{mocks.stored.mockResolvedValue({success:true,emails:[interviewEmail({})]});setup(undefined,"/interview-prep");expect(await screen.findByRole("link",{name:"Prepare for this interview"})).toHaveAttribute("href","/interview-prep?email=101");});
test("a malformed prep queue stays unavailable, retains interview evidence and can retry",async()=>{
 mocks.stored.mockResolvedValue({success:true,emails:[interviewEmail({})]});
 mocks.queue.mockResolvedValue({success:true,queue:{doToday:[{id:"broken-action"}],thisWeek:[],later:[],blocked:[]}});
 setup(undefined,"/interview-prep");
 expect(await screen.findByText("Your prep tasks could not be checked")).toBeVisible();
 expect(screen.getByText("Quillstone Learning · Curriculum Developer")).toBeVisible();
 expect(screen.queryByText("No current prep task was found for this interview.")).not.toBeInTheDocument();
 expect(screen.getByRole("link",{name:"Prepare for this interview"})).toHaveAttribute("href","/interview-prep?email=101");
 mocks.queue.mockResolvedValue({success:true,queue:{doToday:[prepAction],thisWeek:[],later:[],blocked:[]}});
 await userEvent.click(screen.getByRole("button",{name:"Try again"}));
 expect(await screen.findByRole("link",{name:"Prepare for this interview"})).toHaveAttribute("href",`/interview-prep?action=${logicalKey}&version=${dedupeKey}`);
 expect(screen.queryByText("Your prep tasks could not be checked")).not.toBeInTheDocument();
});
test("a failed prep-queue read cannot claim that a known interview has no task",async()=>{
 mocks.stored.mockResolvedValue({success:true,emails:[interviewEmail({})]});
 mocks.queue.mockRejectedValue(new Error("Fictional queue outage"));
 setup(undefined,"/interview-prep");
 expect(await screen.findByText("Your prep tasks could not be checked")).toBeVisible();
 expect(screen.queryByText("No current prep task was found for this interview.")).not.toBeInTheDocument();
 expect(screen.queryByText("No live interviews right now")).not.toBeInTheDocument();
});
test.each([{},[],{doToday:[],thisWeek:[],later:[]}])("missing prep-queue buckets are unavailable rather than a successful empty list: %j",async queue=>{
 mocks.stored.mockResolvedValue({success:true,emails:[interviewEmail({})]});
 mocks.queue.mockResolvedValue({success:true,queue});setup(undefined,"/interview-prep");
 expect(await screen.findByText("Your prep tasks could not be checked")).toBeVisible();
 expect(screen.queryByText("No current prep task was found for this interview.")).not.toBeInTheDocument();
});
test("a failed task refresh replaces the stale task link with an exact invitation link",async()=>{
 mocks.stored.mockResolvedValue({success:true,emails:[interviewEmail({})]});
 mocks.queue.mockResolvedValue({success:true,queue:{doToday:[prepAction],thisWeek:[],later:[],blocked:[]}});
 const page=setup(undefined,"/interview-prep");await screen.findByRole("link",{name:"Prepare for this interview"});
 mocks.queue.mockRejectedValue(new Error("Fictional refresh outage"));
 await page.client.refetchQueries({queryKey:["interview-prep","queue","owner"]});
 expect(await screen.findByText("Your prep tasks could not be checked")).toBeVisible();
 expect(screen.getByRole("link",{name:"Prepare for this interview"})).toHaveAttribute("href","/interview-prep?email=101");
 expect(screen.queryByText("No current prep task was found for this interview.")).not.toBeInTheDocument();
});
test("a failed load shows an error with retry, not 'no interviews'",async()=>{mocks.stored.mockRejectedValue(Object.assign(new Error("Too many requests"),{status:429}));setup(undefined,"/interview-prep");expect(await screen.findByText("Your interviews did not load")).toBeInTheDocument();expect(screen.queryByText("No live interviews right now")).not.toBeInTheDocument();expect(screen.getByRole("button",{name:"Try again"})).toBeInTheDocument();});

// Designer + mobile + teacher review, 2026-10-15.
test("the task card sits under the page heading, not above it",async()=>{setup();const heading=await screen.findByRole("heading",{level:1,name:"Interview preparation"});const card=screen.getByLabelText("Action context");expect(heading.compareDocumentPosition(card)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();});
const invitationText=["Hi Sam,","We would like to invite you to interview for the Receptionist role on Tuesday at 10:00 AM via Zoom.","Please be ready to walk us through how you keep a busy front desk calendar accurate.","You will manage appointment scheduling and patient records for two clinics.","Best,","Dana"].join(String.fromCharCode(10));
test("a posting without detected topics explains the disabled build and exposes the remedy",async()=>{
  setup();
  await screen.findByText("Example Health · Receptionist");
  fireEvent.change(screen.getByLabelText("Posting for this role"),{target:{value:'Additional company context. '.repeat(8)}});
  expect(await screen.findByText(/could not identify practice topics/i)).toBeInTheDocument();
  expect(screen.getByRole("button",{name:"Build my practice"})).toBeDisabled();
  expect(screen.getByLabelText("Responsibilities or requirements to practice")).toBeVisible();
});
test("with no posting pasted, one tap builds practice from the invitation and the preselected resume",async()=>{mocks.source.mockResolvedValue({...source,excerpts:[{id:"1",subject:"Invitation",sender:"Dana",text:invitationText,receivedAt:null}]});setup();await screen.findByText("Example Health · Receptionist");const button=screen.getByRole("button",{name:"Build my practice"});await waitFor(()=>expect(button).toBeEnabled());expect(screen.getByTestId("prep-basis")).toHaveTextContent("starting with “Please be ready to walk us through how you keep a busy front desk calendar accurate.”");await userEvent.click(button);await waitFor(()=>expect(mocks.build).toHaveBeenCalledWith({logicalKey,dedupeKey,sourceVersion:source.sourceVersion,variantId,jobDescription:invitationText,focusAreas:["Please be ready to walk us through how you keep a busy front desk calendar accurate.","You will manage appointment scheduling and patient records for two clinics."]},{signal:expect.any(AbortSignal)}));expect(await screen.findByText("From the invitation")).toBeInTheDocument();});
test("a checked resume is not submitted evidence and does not replace the named default",async()=>{const other="ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee";mocks.history.mockResolvedValue({success:true,history:[{id:"v1",job_title:"Receptionist",company_name:"Example Health",resume_variant_id:other,created_at:"2026-10-01T10:00:00"}]});setup();await waitFor(()=>expect(screen.getByLabelText("Resume for this interview")).toHaveValue(variantId));expect(screen.getByTestId("prep-resume-why")).toHaveTextContent("does not confirm what you submitted");});
test("a past interview is not 'confirmed'; it prepares for the next conversation",async()=>{mocks.source.mockResolvedValue({...source,schedule:{startAt:"2026-09-30T14:00:00",timeZone:"America/New_York",hasTime:true,source:"body"}});setup();expect(await screen.findByText("1. Your interview")).toBeInTheDocument();expect(screen.getByText(/The scheduled time has passed/)).toBeInTheDocument();expect(screen.queryByText("1. Confirm the invitation")).toBeNull();expect(screen.getByText("Sep 30, 2026, 10:00 AM EDT.")).toBeInTheDocument();});
test("checking for invitation changes says what it found",async()=>{setup();await screen.findByText("Example Health · Receptionist");await userEvent.click(screen.getByRole("button",{name:"Check for invitation changes"}));expect(await screen.findByText("No changes since you opened this.")).toBeInTheDocument();});

test("an exact confirmed submission wins over the default without inferring a checked version",async()=>{
  const other="ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  mocks.source.mockResolvedValue({...source,resumeSubmission:{status:"confirmed",variantId:other,name:"Other version"}});
  setup();await waitFor(()=>expect(screen.getByLabelText("Resume for this interview")).toHaveValue(other));
  expect(screen.getByTestId("prep-resume-why")).toHaveTextContent("confirmed submitting for this application");
});

test("opting into tab recovery restores notes with a fresh query cache after a reload",async()=>{
  const page=setup();await fill();await build();
  await userEvent.click(screen.getByText("Review source, change setup or enable tab recovery"));await userEvent.click(screen.getByLabelText(/Keep a recovery copy/));
  await userEvent.type(screen.getByLabelText("What I did"),"Recover this fictional rehearsal note.");
  page.unmount();setup();
  expect(await screen.findByLabelText("What I did")).toHaveValue("Recover this fictional rehearsal note.");
  expect(screen.getByLabelText(/Keep a recovery copy/)).toBeChecked();expect(mocks.build).toHaveBeenCalledTimes(1);
});

test("pending copy cannot claim newer edited notes were copied",async()=>{
  setup();await fill();await build();let finish:()=>void;
  Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}))}});
  await userEvent.click(screen.getByRole("button",{name:"Copy practice notes"}));
  await userEvent.type(screen.getByLabelText("What I did"),"Written after the copy started.");
  finish!();await new Promise(resolve=>setTimeout(resolve,0));expect(screen.queryByText(/Practice notes copied/)).not.toBeInTheDocument();
});

test("leaving aborts the in-flight practice request",async()=>{
  mocks.build.mockImplementation(()=>new Promise(()=>{}));const page=setup();await fill();
  await userEvent.click(screen.getByRole("button",{name:"Build my practice"}));
  const signal=mocks.build.mock.calls[0][1].signal as AbortSignal;expect(signal.aborted).toBe(false);
  page.unmount();expect(signal.aborted).toBe(true);
});

test("an edited saved resume makes older practice non-copyable while keeping notes",async()=>{
  const page=setup();await fill();await build();await userEvent.type(screen.getByLabelText("What I did"),"Keep my own notes.");
  mocks.variants.mockResolvedValue({success:true,variants:[{id:variantId,name:"Front desk",isDefault:true,contentVersion:"d".repeat(64)}]});
  await page.client.invalidateQueries({queryKey:["interview-prep","resumes","owner"]});
  await waitFor(()=>expect(screen.getByRole("button",{name:"Copy practice notes"})).toBeDisabled());
  expect(screen.getByLabelText("What I did")).toHaveValue("Keep my own notes.");
  expect(screen.getByRole("button",{name:"Download practice notes"})).toBeEnabled();
});

test("storage quota failure preserves notes and never claims they are recoverable",async()=>{
  setup();await fill();await build();await userEvent.type(screen.getByLabelText("What I did"),"Do not lose this note.");
  const storage=vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new DOMException("Full","QuotaExceededError");});
  try{await userEvent.click(screen.getByText("Review source, change setup or enable tab recovery"));await userEvent.click(screen.getByLabelText(/Keep a recovery copy/));expect(await screen.findByRole("alert")).toHaveTextContent("tab copy could not be saved");expect(screen.getByLabelText("What I did")).toHaveValue("Do not lose this note.");expect(screen.getByLabelText(/Keep a recovery copy/)).not.toBeChecked();}
  finally{storage.mockRestore();}
});

test("a failed resume refresh cannot treat cached practice as verified current data",async()=>{
  const page=setup();await fill();await build();await userEvent.type(screen.getByLabelText("What I did"),"Retain my notes during the resume outage.");
  mocks.variants.mockRejectedValue(new Error("Resume service unavailable."));
  await page.client.invalidateQueries({queryKey:["interview-prep","resumes","owner"]});
  expect(await screen.findByRole("alert")).toHaveTextContent("Your resumes could not be loaded");
  expect(screen.getByRole("button",{name:"Copy practice notes"})).toBeDisabled();expect(screen.getByRole("button",{name:"Download practice notes"})).toBeEnabled();
  expect(screen.getByLabelText("What I did")).toHaveValue("Retain my notes during the resume outage.");
});

test("the interview list counts calendar days like Next Actions, including a late email yesterday",async()=>{
  const morning=new Date();morning.setHours(10,0,0,0);const yesterday=new Date(morning);yesterday.setDate(yesterday.getDate()-1);yesterday.setHours(23,0,0,0);
  const clock=vi.spyOn(Date,"now").mockReturnValue(morning.getTime());
  try{mocks.stored.mockResolvedValue({success:true,emails:[interviewEmail({date:yesterday.toISOString()})]});setup(undefined,"/interview-prep");expect(await screen.findByText("Last email yesterday")).toBeInTheDocument();}
  finally{clock.mockRestore();}
});

const generalSource={kind:"general",sourceVersion:"a".repeat(64),company:"",role:"",threadId:null,schedule:null,excerpts:[],resumeSubmission:{status:"unknown"}};
test("general practice with no resumes gives a usable setup action and never builds",async()=>{
  mocks.source.mockResolvedValue(generalSource);mocks.variants.mockResolvedValue({success:true,variants:[]});setup(undefined,"/interview-prep?practice=general");
  expect(await screen.findByText("Add a readable resume before building your practice.")).toBeVisible();
  expect(screen.getByRole("link",{name:"Manage resumes"})).toHaveAttribute("href","/resumes");expect(screen.getByRole("button",{name:"Build my practice"})).toBeDisabled();expect(mocks.build).not.toHaveBeenCalled();
});
test("general practice builds from a posting with no fabricated invitation or task",async()=>{
  mocks.source.mockResolvedValue(generalSource);setup(undefined,"/interview-prep?practice=general");
  await waitFor(()=>expect(screen.getByLabelText("Resume for this practice")).toHaveValue(variantId));
  expect(screen.getByText(/No invitation is connected/)).toBeVisible();expect(screen.queryByRole("link",{name:/messages in Gmail/})).toBeNull();
  fireEvent.change(screen.getByLabelText("Posting for this role"),{target:{value:posting}});
  fireEvent.change(screen.getByLabelText("Responsibilities or requirements to practice"),{target:{value:quote}});
  await build();expect(mocks.build.mock.calls[0][0]).toEqual({mode:"general",sourceVersion:generalSource.sourceVersion,variantId,jobDescription:posting,focusAreas:[quote]});
  expect(mocks.stored).not.toHaveBeenCalled();expect(mocks.queue).not.toHaveBeenCalled();
});
test("a fully unbound canonical task uses the general workspace without losing its task identity",async()=>{
  mocks.source.mockResolvedValue({...generalSource,logicalKey,dedupeKey});setup();
  await screen.findByText(/No invitation is connected/);expect(screen.getByLabelText("Resume for this practice")).toBeInTheDocument();
  expect(mocks.source.mock.calls[0][0]).toEqual({logicalKey,dedupeKey});
});
test("general practice remains reachable during an inbox outage",async()=>{
  mocks.stored.mockRejectedValue(new Error("Inbox unavailable"));setup(undefined,"/interview-prep");
  await screen.findByText("Your interviews did not load");expect(screen.getByRole("link",{name:"Practice for a role"})).toHaveAttribute("href","/interview-prep?practice=general");
});
test("direct invitation selection loads without requesting the queue",async()=>{
  mocks.source.mockResolvedValue({...source,kind:"invitation",emailId:"101",logicalKey:undefined,dedupeKey:undefined});setup(undefined,"/interview-prep?email=101");
  await screen.findByText("Example Health · Receptionist");expect(mocks.source.mock.calls[0][0]).toEqual({emailId:"101"});expect(mocks.queue).not.toHaveBeenCalled();
});
test("topic navigation retains every answer and exports hidden topics and eligibility notes",async()=>{
  const eligibility={...pack.practice[0],id:"eligibility",quote:"Active nursing licence required before starting.",kind:"eligibility",question:"Explain your current credential status."};
  mocks.build.mockResolvedValue({...pack,practice:[...pack.practice,eligibility]});setup();await fill();
  fireEvent.change(screen.getByLabelText("Posting for this role"),{target:{value:posting+" "+eligibility.quote}});fireEvent.change(screen.getByLabelText("Responsibilities or requirements to practice"),{target:{value:quote+"\n"+eligibility.quote}});await build();
  await userEvent.type(screen.getByLabelText("What I did"),"My first truthful example.");
  await userEvent.click(screen.getByRole("button",{name:"Practice topic 2"}));expect(screen.queryByLabelText("What I did")).toBeNull();
  await userEvent.type(screen.getByLabelText("My current status"),"Credential pending; not held.");
  await userEvent.click(screen.getByRole("button",{name:"Practice topic 1"}));expect(screen.getByLabelText("What I did")).toHaveValue("My first truthful example.");
  const writeText=vi.fn().mockResolvedValue(undefined);Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText}});
  await userEvent.click(screen.getByRole("button",{name:"Copy practice notes"}));expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Credential pending; not held."));expect(writeText).toHaveBeenCalledWith(expect.stringContaining("My first truthful example."));
});
test("the build binds the current saved resume version",async()=>{
  mocks.variants.mockResolvedValue({success:true,variants:[{id:variantId,name:"Front desk",isDefault:true,contentVersion:"b".repeat(64)}]});setup();await fill();await build();
  expect(mocks.build.mock.calls[0][0].expectedResumeVersion).toBe("b".repeat(64));
});
