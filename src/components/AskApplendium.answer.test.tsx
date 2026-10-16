import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AskApplendium } from "./AskApplendium";
import { askAnswerLines } from "@/lib/ask";

// Persona review round 2, 2026-10-15: Ask showed literal **Quillstone Learning**, the internal code
// "interview_quiet", a numbered list crammed into one paragraph, and the draft twice.
const { askApplendium } = vi.hoisted(() => ({ askApplendium: vi.fn() }));
vi.mock("@/lib/ask", async () => ({ ...(await vi.importActual("@/lib/ask")), askApplendium }));

function renderAsk() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><AskApplendium /></MemoryRouter>
    </QueryClientProvider>,
  );
}

async function askSomething() {
  await userEvent.type(screen.getByLabelText("Your question"), "Which interviews have no decision?{Enter}");
  return screen.findByTestId("ask-answer");
}

describe("Ask answers render as plain lines", () => {
  beforeEach(() => askApplendium.mockReset());

  test("answerLines from the backend render one per line, with list items as a list", async () => {
    askApplendium.mockResolvedValue({
      success: true,
      answer: "Two interviews have no decision: 1. Quillstone Learning 2. Brightpath Education",
      answerLines: ["Two interviews have no decision:", "1. Quillstone Learning, interviewed Sep 30 (15 days ago)", "2. Brightpath Education, interviewed Sep 21 (24 days ago)"],
      applications: [],
    });
    renderAsk();
    const answer = await askSomething();
    expect(within(answer).getByText("Two interviews have no decision:").tagName).toBe("P");
    const items = within(answer).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Quillstone Learning, interviewed Sep 30 (15 days ago)",
      "Brightpath Education, interviewed Sep 21 (24 days ago)",
    ]);
    expect(within(answer).getByRole("list").tagName).toBe("OL");
  });

  test("an older backend's answer loses its markdown, codes and inline numbering", async () => {
    askApplendium.mockResolvedValue({
      success: true,
      answer: "Your open interviews: 1. **Quillstone Learning** (interview_quiet) 2. **Brightpath** is a final_check.",
      applications: [],
    });
    renderAsk();
    const answer = await askSomething();
    expect(answer.textContent).not.toMatch(/\*\*|interview_quiet|final_check/);
    expect(within(answer).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Quillstone Learning (no word since the interview)",
      "Brightpath is a final check-in.",
    ]);
  });

  test("the draft appears only in its editable box, never again above it", async () => {
    const body = "Hi Dana,\n\nThank you again for the interview on Sep 30.\n\nBest,\nMaria";
    askApplendium.mockResolvedValue({
      success: true,
      answer: `Here is a follow-up you can send:\n\n${body}`,
      draft: { subject: "Following up", body },
      applications: [],
    });
    renderAsk();
    const answer = await askSomething();
    expect(answer.textContent).toBe("Here is a follow-up you can send:");
    expect(screen.getByDisplayValue(/Thank you again for the interview/)).toBeInTheDocument();
  });

  test("code-computed totals are shown with ever and now labelled apart", async () => {
    askApplendium.mockResolvedValue({
      success: true,
      answer: "x",
      answerLines: ["You have 28 tracked applications. 18 are open."],
      totals: { applications: 28, open: 18, noReplyYet: 14, waitingForReply: 8, wentQuiet: 6, inInterviewStage: 4, stillInterviewing: 2, noWordSinceInterview: 2, reachedInterview: 6, offers: 1, rejected: 9, closedByYou: 0, closed: 9, interviewRate: 0.214 },
      applications: [],
    });
    renderAsk();
    await askSomething();
    const totals = screen.getByTestId("ask-totals");
    expect(totals).toHaveTextContent("Reached an interview (ever)6");
    expect(totals).toHaveTextContent("In interviews (now)4");
    expect(totals).toHaveTextContent("Open now18");
  });

  test("the day 21-29 step is labelled Final check-in", async () => {
    askApplendium.mockResolvedValue({
      success: true,
      answer: "One application is due a last check-in.",
      answerLines: ["One application is due a last check-in."],
      applications: [{ ref: "A1", company: "Pinehollow", role: "Math Curriculum Writer", stage: "waiting", appliedOn: "2026-09-16", lastUpdateOn: "2026-09-16", nextStep: "final_check", threadId: null }],
    });
    renderAsk();
    await askSomething();
    expect(within(screen.getByTestId("ask-applications")).getByText(/Final check-in/)).toBeInTheDocument();
  });

  test("helper: a draft-only answer still says something", () => {
    expect(askAnswerLines({ answer: "Hi\nThanks", draft: { body: "Hi\nThanks" } })).toEqual(["Here is a draft you can edit and copy."]);
    expect(askAnswerLines({ answer: "Plain answer.", answerLines: [] })).toEqual(["Plain answer."]);
    // A date and a number are not a list.
    expect(askAnswerLines({ answer: "You applied Sep 3. 4 more are waiting." })).toEqual(["You applied Sep 3. 4 more are waiting."]);
  });
});
