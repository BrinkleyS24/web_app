import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { OutreachDraftEditor } from "./OutreachDraftEditor";
import type { SuggestionDraft } from "@/lib/emails";
const auth=vi.hoisted(()=>vi.fn());
vi.mock("@/lib/AuthContext.jsx",()=>({useAuth:()=>auth()}));
const draft={subject:"Follow-up",body:"Hello,\n\nAny updates?\n\nBest,\n[Your Name]",context:"warm",actionType:"follow_up",confidence:"medium"} as SuggestionDraft;
const url="https://mail.google.com/mail/u/0/#all/thread-id";
const clipboard=vi.fn();
function setup() {
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  const view=(key="job-v1",value=draft)=><QueryClientProvider client={client}><OutreachDraftEditor key={key} draft={value} draftKey={key} gmailUrl={url}/></QueryClientProvider>;
  return {view,...render(view())};
}
beforeEach(()=>{auth.mockReturnValue({user:{uid:"owner",displayName:"Stacey"}}); clipboard.mockReset().mockResolvedValue(undefined); Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:clipboard}});});
test("edited subject, message and signature are the bytes copied",async()=>{
  const user=userEvent.setup(); Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:clipboard}}); setup();
  await user.clear(screen.getByLabelText("Subject")); await user.type(screen.getByLabelText("Subject"),"Updated subject");
  await user.clear(screen.getByLabelText("Message")); await user.type(screen.getByLabelText("Message"),"Hello,\nMy edited message.\nBest,");
  await user.clear(screen.getByLabelText("Your signature")); await user.type(screen.getByLabelText("Your signature"),"Stacey Brinkley");
  await user.click(screen.getByRole("button",{name:"Copy subject + body"}));
  expect(clipboard).toHaveBeenCalledWith("Subject: Updated subject\n\nHello,\nMy edited message.\nBest,\nStacey Brinkley");
  expect(screen.getByRole("link",{name:"Open Gmail conversation"})).toHaveAttribute("href",url);
  expect(screen.getByText(/does not send this message/)).toBeInTheDocument();
});
test("unknown name requires explicit signature; old placeholder is removed",()=>{
  auth.mockReturnValue({user:{uid:"owner"}}); setup();
  expect(screen.getByLabelText("Message")).not.toHaveValue(expect.stringContaining("[Your Name]"));
  expect(screen.getByRole("button",{name:"Copy draft"})).toBeDisabled(); expect(screen.getByText(/Add your signature/)).toBeInTheDocument();
});
test("fill-in placeholders and empty messages block copy",async()=>{
  const {rerender,view}=setup(); rerender(view("job-v2",{...draft,body:"I liked [your project].\nBest,"}));
  expect(screen.getByRole("button",{name:"Copy draft"})).toBeDisabled();
  await userEvent.clear(screen.getByLabelText("Message")); expect(screen.getByText(/Add a message/)).toBeInTheDocument();
});
test("task versions and presets keep separate edits and restore the original",async()=>{
  const {rerender,view}=setup(); await userEvent.clear(screen.getByLabelText("Message")); await userEvent.type(screen.getByLabelText("Message"),"My first edited version");
  rerender(view("job-v1:concise",{...draft,context:"concise",body:"Short version.\nBest,"})); expect(screen.getByLabelText("Message")).toHaveValue("Short version.\nBest,");
  rerender(view()); expect(screen.getByLabelText("Message")).toHaveValue("My first edited version");
  rerender(view("job-v2")); expect(screen.getByLabelText("Message")).not.toHaveValue("My first edited version");
});
test("same-account page unmount and return retains edits in memory",async()=>{
  const {rerender,view}=setup(); await userEvent.clear(screen.getByLabelText("Subject")); await userEvent.type(screen.getByLabelText("Subject"),"Keep across navigation");
  rerender(<div>Another page</div>); rerender(view()); expect(screen.getByLabelText("Subject")).toHaveValue("Keep across navigation");
});
test("switching owners cannot render the previous owner's edits",async()=>{
  const {rerender,view}=setup(); await userEvent.clear(screen.getByLabelText("Message")); await userEvent.type(screen.getByLabelText("Message"),"Owner A private edit");
  auth.mockReturnValue({user:{uid:"other",displayName:"Other"}}); rerender(view());
  expect(screen.getByLabelText("Message")).not.toHaveValue("Owner A private edit"); expect(screen.getByLabelText("Your signature")).toHaveValue("Other");
});
test("clipboard rejection preserves edits and offers manual copy",async()=>{
  setup(); clipboard.mockRejectedValue(new Error("denied")); await userEvent.click(screen.getByRole("button",{name:"Copy draft"}));
  expect(await screen.findByText(/Copy failed/)).toBeInTheDocument(); expect(screen.getByLabelText("Your signature")).toHaveValue("Stacey");
});
