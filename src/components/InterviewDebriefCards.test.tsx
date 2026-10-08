import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { InterviewDebriefCards } from "./InterviewDebriefCards";
import { INTERVIEW_DEBRIEF_ANSWERS } from "@/lib/emails";
import { ApiRequestError } from "@/lib/api.js";

const { recordInterviewDebrief } = vi.hoisted(() => ({ recordInterviewDebrief: vi.fn() }));

vi.mock("@/lib/emails", async () => {
  const actual = await vi.importActual<typeof import("@/lib/emails")>("@/lib/emails");
  return { ...actual, recordInterviewDebrief };
});

const items = [
  {
    key: "verisk||sdet",
    emailId: 101,
    label: "Verisk · Software Engineer in Test",
    company: "Verisk",
    position: "Software Engineer in Test",
    interviewedAt: "2026-07-16T00:00:00.000Z",
    daysSilent: 20,
    silentLabel: "20 days ago",
  },
  {
    key: "onebrief||qa",
    emailId: 102,
    label: "Onebrief · QA Engineer",
    company: "Onebrief",
    position: "QA Engineer",
    interviewedAt: "2026-05-01T00:00:00.000Z",
    daysSilent: 96,
    silentLabel: "3 months ago",
  },
];

function renderCards(total = items.length) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <InterviewDebriefCards items={items} total={total} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  recordInterviewDebrief.mockResolvedValue({ success: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("InterviewDebriefCards", () => {
  test("asks about one named interview at a time, and says how many are left", () => {
    renderCards();

    // Naming the role is the whole point. "Tell us how your interviews went" is homework;
    // "Verisk · SDET · interviewed 20 days ago" is a memory the user can answer from.
    expect(screen.getByText("Verisk · Software Engineer in Test")).toBeInTheDocument();
    expect(screen.getByText(/interviewed 20 days ago/)).toBeInTheDocument();
    expect(screen.queryByText("Onebrief · QA Engineer")).not.toBeInTheDocument();
    expect(screen.getByText(/1 more · about 1 minute/)).toBeInTheDocument();
    // The cost of stopping has to be zero, or the ask reads as an obligation.
    expect(screen.getByText(/Stop whenever you like/)).toBeInTheDocument();
  });

  test("an answer is recorded against the interview it was asked about", async () => {
    const user = userEvent.setup();
    renderCards();

    await user.click(screen.getByRole("button", { name: "Never heard back" }));

    await waitFor(() => expect(recordInterviewDebrief).toHaveBeenCalledWith({
      emailId: 101,
      answer: "no_response",
    }));

    // And the stack advances without a reload or a navigation.
    expect(await screen.findByText("Onebrief · QA Engineer")).toBeInTheDocument();
  });

  test("a rejection the user remembers is recorded as an adverse decision", async () => {
    const user = userEvent.setup();
    renderCards();

    await user.click(screen.getByRole("button", { name: "Rejected" }));

    await waitFor(() => expect(recordInterviewDebrief).toHaveBeenCalledWith({
      emailId: 101,
      answer: "rejected",
    }));
  });

  test("a process the user says is still alive writes nothing at all", async () => {
    const user = userEvent.setup();
    renderCards();

    await user.click(screen.getByRole("button", { name: "Still live" }));

    // A live process is a censored observation, not an ending. Recording one would put a
    // fictional outcome into the funnel this feature exists to stop guessing about.
    expect(await screen.findByText("Onebrief · QA Engineer")).toBeInTheDocument();
    expect(recordInterviewDebrief).not.toHaveBeenCalled();
  });

  test("a failed save keeps the card instead of pretending it landed", async () => {
    const user = userEvent.setup();
    recordInterviewDebrief.mockRejectedValue(new Error("offline"));
    renderCards();

    await user.click(screen.getByRole("button", { name: "Rejected" }));

    expect(await screen.findByText(/That did not save/)).toBeInTheDocument();
    // Swallowing this would look like the answer was accepted and then have the same question
    // reappear tomorrow, which is worse than never asking.
    expect(screen.getByText("Verisk · Software Engineer in Test")).toBeInTheDocument();
  });

  test("finishing the stack confirms what was recorded rather than vanishing", async () => {
    const user = userEvent.setup();
    renderCards();

    await user.click(screen.getByRole("button", { name: "Never heard back" }));
    await screen.findByText("Onebrief · QA Engineer");
    await user.click(screen.getByRole("button", { name: "Rejected" }));

    expect(await screen.findByText(/2 recorded/)).toBeInTheDocument();
  });
  test.each([
    [401, undefined, /Your sign-in has expired/],
    [404, undefined, /email or its application is no longer available/],
    [409, "APPLICATION_LINK_BUSY", /Your jobs are being updated/],
    [409, "APPLICATION_LINK_REVIEW_REQUIRED", /could not link this email to one application safely/],
    [409, "APPLICATION_LINK_LIMIT", /tracking limit is reached/],
    [500, undefined, /Applendium™ could not save/],
  ])("explains a %s save failure without blaming the connection", async (status, code, message) => {
    recordInterviewDebrief.mockRejectedValue(new ApiRequestError("save failed", { status, payload: { code } }));
    const user = userEvent.setup();
    renderCards();
    await user.click(screen.getByRole("button", { name: "Rejected" }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByText("Verisk · Software Engineer in Test")).toBeInTheDocument();
    expect(screen.queryByText(/Check your connection/)).not.toBeInTheDocument();
  });
  test("a malformed successful response never dismisses the card", async () => {
    recordInterviewDebrief.mockResolvedValue({ success: false });
    const user = userEvent.setup();
    renderCards();
    await user.click(screen.getByRole("button", { name: "Rejected" }));
    expect(await screen.findByText(/That did not save/)).toBeInTheDocument();
    expect(screen.getByText("Verisk · Software Engineer in Test")).toBeInTheDocument();
  });
  test("an inbox outcome arriving before the answer is not claimed as a new answer", async () => {
    recordInterviewDebrief.mockResolvedValue({ success: true, recorded: false });
    const user = userEvent.setup();
    renderCards();
    await user.click(screen.getByRole("button", { name: "Rejected" }));
    await screen.findByText("Onebrief · QA Engineer");
    await user.click(screen.getByRole("button", { name: "Never heard back" }));
    expect(await screen.findByText(/already have tracked outcomes/)).toBeInTheDocument();
    expect(screen.queryByText(/recorded/)).not.toBeInTheDocument();
  });
  test("rapid taps cannot submit two competing answers", async () => {
    let finish!: (value: { success: boolean }) => void;
    recordInterviewDebrief.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    renderCards();
    fireEvent.click(screen.getByRole("button", { name: "Rejected" }));
    fireEvent.click(screen.getByRole("button", { name: "Never heard back" }));
    expect(recordInterviewDebrief).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Still live" })).toBeDisabled();
    finish({ success: true });
    expect(await screen.findByText("Onebrief · QA Engineer")).toBeInTheDocument();
  });

  test("dismissing every card without answering leaves no false confirmation", async () => {
    const user = userEvent.setup();
    renderCards();

    await user.click(screen.getByRole("button", { name: "Still live" }));
    await screen.findByText("Onebrief · QA Engineer");
    await user.click(screen.getByRole("button", { name: "Still live" }));

    await waitFor(() => expect(screen.queryByText("Onebrief · QA Engineer")).not.toBeInTheDocument());
    expect(screen.queryByText(/recorded/)).not.toBeInTheDocument();
  });

  test("the countdown reflects the whole ask, not just the cards in hand", () => {
    // The payload caps the rows it carries; the user is being asked about more than that.
    renderCards(19);

    expect(screen.getByText(/18 more · about 3 minutes/)).toBeInTheDocument();
  });

  test("each answer maps to a close label the backend taxonomy already understands", () => {
    // This is the one string in the feature with a cross-repo consumer. `classifyManualCloseKind`
    // reads the leading segment before " - ", so "No response" must stay the lead or a ghosting
    // gets recorded as a rejection the employer never sent. The backend pins the other half of
    // this coupling in tests/utils/applicationCloseOutcome.test.js.
    expect(INTERVIEW_DEBRIEF_ANSWERS.no_response.reason).toBe("No response - interview debrief");
    expect(INTERVIEW_DEBRIEF_ANSWERS.rejected.reason).toBe("Rejected - interview debrief");
    expect(INTERVIEW_DEBRIEF_ANSWERS.withdrew.reason).toBe("Withdrew - interview debrief");
  });
});

describe('displayed batch identity', () => {
  test('background updates do not replace the role or reference under the user', async () => {
    const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});
    const actionReference='j1.101.42.'+'a'.repeat(64);
    const original=[{...items[0],actionReference}];
    const view=render(<QueryClientProvider client={queryClient}><InterviewDebriefCards items={original} total={1}/></QueryClientProvider>);
    view.rerender(<QueryClientProvider client={queryClient}><InterviewDebriefCards items={[{...items[1],actionReference:'j1.102.43.'+'b'.repeat(64)}]} total={1}/></QueryClientProvider>);
    expect(screen.getByText(items[0].label)).toBeInTheDocument();
    expect(screen.queryByText(items[1].label)).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button',{name:'Rejected'}));
    expect(recordInterviewDebrief).toHaveBeenCalledWith({emailId:101,answer:'rejected',actionReference});
  });
  test.each([[409,'APPLICATION_CHANGED'],[503,'APPLICATION_ACTION_UNAVAILABLE']])('a %s stale/unavailable action retains its card and requires refresh',async(status,code)=>{
    recordInterviewDebrief.mockRejectedValue(new ApiRequestError('changed',{status,payload:{code}}));
    renderCards();
    await userEvent.setup().click(screen.getByRole('button',{name:'Rejected'}));
    expect(await screen.findByRole('button',{name:'Refresh page'})).toBeInTheDocument();
    expect(screen.getByText(items[0].label)).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Rejected'})).toBeDisabled();
    expect(screen.queryByText(/recorded/)).not.toBeInTheDocument();
  });
  test('a retry after network failure keeps its original reference',async()=>{
    const actionReference='j1.101.42.'+'a'.repeat(64);
    const client=new QueryClient();
    recordInterviewDebrief.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({success:true,recorded:true});
    render(<QueryClientProvider client={client}><InterviewDebriefCards items={[{...items[0],actionReference}]} total={1}/></QueryClientProvider>);
    const user=userEvent.setup();
    await user.click(screen.getByRole('button',{name:'Rejected'}));
    await screen.findByText(/Check your connection/);
    await user.click(screen.getByRole('button',{name:'Rejected'}));
    expect(recordInterviewDebrief.mock.calls[0]).toEqual(recordInterviewDebrief.mock.calls[1]);
    expect(recordInterviewDebrief.mock.calls[1][0].actionReference).toBe(actionReference);
  });
  test('explicitly unsafe history cannot submit an unguarded answer',()=>{
    const client=new QueryClient();
    render(<QueryClientProvider client={client}><InterviewDebriefCards items={[{...items[0],actionReference:null}]} total={1}/></QueryClientProvider>);
    expect(screen.getByRole('button',{name:'Rejected'})).toBeDisabled();
    expect(screen.getByText(/could not identify this application safely/)).toBeInTheDocument();
    expect(recordInterviewDebrief).not.toHaveBeenCalled();
  });
});
