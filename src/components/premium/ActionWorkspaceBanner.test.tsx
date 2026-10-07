import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ActionWorkspaceBanner } from "./ActionWorkspaceBanner";
import { ActionCtaButton } from "./ActionPieces";
import type { QueueItem } from "@/lib/premiumTaskQueue";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), queue: vi.fn(), complete: vi.fn() }));
vi.mock("@/lib/AuthContext.jsx", () => ({ useAuth: () => mocks.auth() }));
vi.mock("@/lib/emails", () => ({ fetchRankedActionQueue: (...args: unknown[]) => mocks.queue(...args), completeQueueAction: (...args: unknown[]) => mocks.complete(...args) }));
const key = "0123456789abcdef", version = "fedcba9876543210";
const item = { id: "action-card", logicalKey: key, dedupeKey: version, company: "Example Health", roleTitle: "Receptionist", title: "Show your front-desk experience", whyNow: "The posting asks for scheduling experience.", evidence: ["Scheduling appears in the posting."], effectiveStatus: "open", status: "open", createdAt: "2026-10-06T00:00:00Z" };
const response = (overrides = {}) => ({success:true,queue:{resolvedActions:[{...item,...overrides}]}});
function setup(path = `/resumes?action=${key}&version=${version}`) {
  const client = new QueryClient({ defaultOptions: {queries:{retry:false},mutations:{retry:false}} });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><ActionWorkspaceBanner /></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockReturnValue({user:{uid:"owner"}}); mocks.queue.mockResolvedValue(response()); mocks.complete.mockResolvedValue({success:true,state:"completed"}); });
describe("action workspace", () => {
  test("actual tool navigation keeps the exact task, shows evidence and does not complete it", async () => {
    const client = new QueryClient({defaultOptions:{queries:{retry:false}}});
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/dashboard"]}><Routes>
      <Route path="/dashboard" element={<ActionCtaButton item={item as unknown as QueueItem} cta={{kind:"route",label:"Update resume",href:"/resumes"}} className="" />} />
      <Route path="/resumes" element={<ActionWorkspaceBanner />} />
    </Routes></MemoryRouter></QueryClientProvider>);
    await userEvent.click(screen.getByRole("link",{name:"Update resume"}));
    expect(await screen.findByText(item.title)).toBeInTheDocument();
    await userEvent.click(screen.getByText("Evidence for this task"));
    expect(screen.getByText(item.evidence[0])).toBeInTheDocument();
    expect(screen.getByRole("link",{name:"Back to Next Actions"})).toHaveAttribute("href","/next-actions#action-card");
    expect(mocks.complete).not.toHaveBeenCalled();
  });
  test("explicit completion sends the original version and survives failed refetch", async () => {
    mocks.queue.mockResolvedValueOnce(response()).mockRejectedValue(new Error("offline"));
    setup(); await userEvent.click(await screen.findByRole("button",{name:"I've finished this task"}));
    expect(await screen.findByText(/Task marked done/)).toBeInTheDocument();
    expect(mocks.complete).toHaveBeenCalledWith({logicalKey:key,dedupeKey:version});
    expect(screen.queryByText(/did not confirm a save/)).not.toBeInTheDocument();
  });
  test.each(["blocked","dismissed","expired"])("%s task cannot be completed", async status => {
    mocks.queue.mockResolvedValue(response({effectiveStatus:status})); setup();
    await waitFor(()=>expect(screen.queryByText(/Loading the job/)).not.toBeInTheDocument());
    expect(screen.queryByRole("button",{name:"I've finished this task"})).not.toBeInTheDocument(); expect(mocks.complete).not.toHaveBeenCalled();
  });
  test("a changed evidence version cannot be silently adopted", async () => {
    mocks.queue.mockResolvedValue(response({dedupeKey:"aaaaaaaaaaaaaaaa"})); setup();
    expect(await screen.findByText(/task changed after/)).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"I've finished this task"})).not.toBeInTheDocument();
  });
  test("missing action offers review without guessing another job", async () => {
    mocks.queue.mockResolvedValue({success:true,queue:{resolvedActions:[]}}); setup();
    expect(await screen.findByText(/task is no longer available/)).toBeInTheDocument(); expect(mocks.complete).not.toHaveBeenCalled();
  });
  test("failed completion keeps recovery and never claims success", async () => {
    mocks.complete.mockRejectedValue(new Error("conflict")); setup(); await userEvent.click(await screen.findByRole("button",{name:"I've finished this task"}));
    expect(await screen.findByRole("alert")).toHaveTextContent(/did not confirm a save/);
    expect(screen.queryByText(/Task marked done/)).not.toBeInTheDocument(); expect(screen.getByRole("button",{name:"Reload task"})).toBeInTheDocument();
  });
  test("rapid repeated clicks cannot create concurrent completion requests", async () => {
    mocks.complete.mockImplementation(()=>new Promise(()=>{})); setup(); const button=await screen.findByRole("button",{name:"I've finished this task"});
    await userEvent.dblClick(button); expect(mocks.complete).toHaveBeenCalledTimes(1);
  });
  test("false success envelopes and malformed queue data fail honestly", async () => {
    mocks.queue.mockResolvedValue({success:true,queue:{}}); setup();
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be loaded/); expect(mocks.complete).not.toHaveBeenCalled();
  });
  test("ordinary tool visits make no queue request", () => { setup("/resumes"); expect(mocks.queue).not.toHaveBeenCalled(); });
  test("malformed and duplicate keys are refused before fetching", () => { setup(`/apply-gate?action=${key}&action=${key}&version=${version}`); expect(screen.getByText(/link is incomplete/)).toBeInTheDocument(); expect(mocks.queue).not.toHaveBeenCalled(); });
});
