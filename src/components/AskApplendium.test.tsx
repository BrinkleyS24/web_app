import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AskApplendium, ASK_SUGGESTIONS } from "./AskApplendium";

const { askApplendium } = vi.hoisted(() => ({ askApplendium: vi.fn() }));
vi.mock("@/lib/ask", async () => {
  const actual = await vi.importActual("@/lib/ask");
  return { ...actual, askApplendium };
});

function renderAsk() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><AskApplendium /></MemoryRouter>
    </QueryClientProvider>,
  );
}

const ANSWER = {
  success: true,
  answer: "Two companies haven't replied in over two weeks: Acme Corp and Initech.",
  applications: [
    { ref: "A4", company: "Acme Corp", role: "Test Analyst", stage: "quiet", appliedOn: "2026-08-17", lastUpdateOn: "2026-08-17", nextStep: null, threadId: "t-acme" },
    { ref: "A5", company: "Initech", role: null, stage: "waiting", appliedOn: "2026-09-14", lastUpdateOn: "2026-09-14", nextStep: "follow_up", why: "12 days with no reply · Applendium suggests a follow-up on days 10–14", threadId: null },
  ],
  basis: { applications: 5, earliestTrackedOn: "2026-08-07" },
};

describe("AskApplendium", () => {
  beforeEach(() => askApplendium.mockReset());

  test("a resume-selection answer has a working Apply Gate handoff and accurate privacy copy", async () => {
    askApplendium.mockResolvedValue({ success: true, answer: "I need the posting to compare your saved resumes.", applications: [], handoff: { kind: "apply_gate", label: "Compare resumes in Apply Gate" } });
    renderAsk();
    await userEvent.type(screen.getByLabelText("Your question"), "Which resume should I use?{Enter}");
    expect(await screen.findByRole("link", { name: "Compare resumes in Apply Gate" })).toHaveAttribute("href", "/apply-gate");
    expect(screen.getByText(/No resume content was sent to AI/)).toBeInTheDocument();
    expect(screen.queryByText(/Based on 0 tracked applications/)).not.toBeInTheDocument();
  });

  test("no saved resumes sends the member to the resume workspace", async () => {
    askApplendium.mockResolvedValue({ success: true, answer: "Save a resume first.", applications: [], handoff: { kind: "resumes", label: "Add a resume" } });
    renderAsk();
    await userEvent.type(screen.getByLabelText("Your question"), "Which CV is best?{Enter}");
    expect(await screen.findByRole("link", { name: "Add a resume" })).toHaveAttribute("href", "/resumes");
  });

  test("the additive quiet-interview marker overrides the legacy stage label", async () => {
    askApplendium.mockResolvedValue({ ...ANSWER, applications: [{ ...ANSWER.applications[0], stage: "interviewing", interviewQuiet: true }] });
    renderAsk();
    await userEvent.click(screen.getByRole("button", { name: ASK_SUGGESTIONS[0] }));
    expect(await screen.findByText("No word since the interview")).toBeInTheDocument();
    expect(screen.queryByText("Still interviewing")).not.toBeInTheDocument();
  });

  test("offers starting questions and asks one on click", async () => {
    askApplendium.mockResolvedValue(ANSWER);
    renderAsk();

    await userEvent.click(screen.getByRole("button", { name: ASK_SUGGESTIONS[0] }));

    expect(askApplendium).toHaveBeenCalledWith(ASK_SUGGESTIONS[0]);
    expect(await screen.findByTestId("ask-answer")).toHaveTextContent("Acme Corp and Initech");
    expect(screen.getByText(ASK_SUGGESTIONS[0], { selector: "span" })).toBeInTheDocument();
  });

  test("lists the applications the answer is about, with their stage and a way back to the email", async () => {
    askApplendium.mockResolvedValue(ANSWER);
    renderAsk();

    await userEvent.type(screen.getByLabelText("Your question"), "Who is ignoring me?{Enter}");

    const list = await screen.findByTestId("ask-applications");
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Acme Corp");
    expect(rows[0]).toHaveTextContent("Went quiet");
    expect(within(rows[0]).getByRole("link", { name: /Open in Gmail/ })).toHaveAttribute(
      "href",
      "https://mail.google.com/mail/u/0/#all/t-acme",
    );
    // No thread, no link — never a dead one.
    expect(within(rows[1]).queryByRole("link")).toBeNull();
    expect(rows[1]).toHaveTextContent("Waiting on a reply");
    // What is due comes from the backend's follow-up timing; nothing due says nothing.
    expect(rows[1]).toHaveTextContent("Last update Sep 14 · Time to follow up");
    expect(rows[0]).not.toHaveTextContent("follow up");
    // The why line our backend wrote, under the application it explains; none where nothing is due.
    expect(within(rows[1]).getByTestId("why-line")).toHaveTextContent("Why: 12 days with no reply · Applendium suggests a follow-up on days 10–14");
    expect(within(rows[0]).queryByTestId("why-line")).toBeNull();
    expect(screen.getByText(/Based on 5 tracked applications since Aug 7/)).toBeInTheDocument();
    expect(screen.getByText(/never the text of your emails/)).toBeInTheDocument();
  });

  test("names a booked interview and an open assessment as what to do, with the date the email gave", async () => {
    askApplendium.mockResolvedValue({
      ...ANSWER,
      answer: "Finish the Kestrel assessment by Mon, Oct 5, and prepare for Quillstone on Tue, Oct 6.",
      applications: [
        { ref: "A1", company: "Kestrel", role: "Instructional Designer", stage: "interviewing", appliedOn: "2026-09-15", lastUpdateOn: "2026-09-24", nextStep: "complete_assessment", why: "Asked for an assessment on Thu, Sep 24 · due Mon, Oct 5 (in 2 days)", threadId: "t-k" },
        { ref: "A2", company: "Quillstone", role: "Curriculum Developer", stage: "interviewing", appliedOn: "2026-09-12", lastUpdateOn: "2026-09-26", nextStep: "prepare_interview", why: "Interview on Tue, Oct 6 at 10:00 AM EDT · in 3 days", threadId: "t-q" },
      ],
    });
    renderAsk();

    await userEvent.type(screen.getByLabelText("Your question"), "What should I do this week?{Enter}");

    const rows = within(await screen.findByTestId("ask-applications")).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Last update Sep 24 · Finish the assessment");
    expect(within(rows[0]).getByTestId("why-line")).toHaveTextContent("due Mon, Oct 5 (in 2 days)");
    expect(rows[1]).toHaveTextContent("Last update Sep 26 · Prepare for the interview");
    expect(within(rows[1]).getByTestId("why-line")).toHaveTextContent("Interview on Tue, Oct 6 at 10:00 AM EDT");
  });

  test("shows an email straight from the inbox, says the AI didn't read it, and notes what it said", async () => {
    askApplendium.mockResolvedValue({
      success: true,
      answer: "Here is what Globex wrote on Sep 20. It gives no reason.",
      applications: [
        { ref: "A1", company: "Globex", role: "SDET", stage: "rejected", appliedOn: "2026-09-06", lastUpdateOn: "2026-09-20", nextStep: null, why: null, note: "Rejection gave no reason", threadId: "t-globex" },
      ],
      quotes: [
        { ref: "A1", company: "Globex", role: "SDET", kind: "rejection", date: "2026-09-20", passage: "Hi Sam, we chose another candidate.", rejectionNote: "Rejection gave no reason", threadId: "t-globex" },
      ],
      basis: { applications: 5, earliestTrackedOn: "2026-08-07" },
    });
    renderAsk();

    await userEvent.type(screen.getByLabelText("Your question"), "What did Globex say?{Enter}");

    const quotes = await screen.findByTestId("ask-quotes");
    expect(within(quotes).getByText("What Globex wrote · Sep 20")).toBeInTheDocument();
    expect(within(quotes).getByText("Hi Sam, we chose another candidate.")).toBeInTheDocument();
    expect(within(quotes).getByText("Shown straight from your inbox. The AI didn't read it.")).toBeInTheDocument();
    expect(within(quotes).getByRole("link", { name: /Open in Gmail/ })).toHaveAttribute("href", "https://mail.google.com/mail/u/0/#all/t-globex");
    expect(within(screen.getByTestId("ask-applications")).getByTestId("note-line")).toHaveTextContent("From your inbox: Rejection gave no reason");
  });

  test("a failure says so and offers a retry", async () => {
    askApplendium.mockRejectedValueOnce(new Error("That's 30 questions today. Ask again tomorrow."));
    renderAsk();

    await userEvent.type(screen.getByLabelText("Your question"), "Anything new?{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("30 questions today");
    askApplendium.mockResolvedValueOnce(ANSWER);
    await userEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(await screen.findByTestId("ask-answer")).toBeInTheDocument();
    expect(askApplendium).toHaveBeenLastCalledWith("Anything new?");
  });

  test("a question too short to mean anything cannot be sent", async () => {
    renderAsk();
    await userEvent.type(screen.getByLabelText("Your question"), "hi");
    expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
  });
});
