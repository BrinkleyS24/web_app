import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
      <AskApplendium />
    </QueryClientProvider>,
  );
}

const ANSWER = {
  success: true,
  answer: "Two companies haven't replied in over two weeks: Acme Corp and Initech.",
  applications: [
    { ref: "A4", company: "Acme Corp", role: "Test Analyst", stage: "quiet", appliedOn: "2026-08-17", lastUpdateOn: "2026-08-17", nextStep: null, threadId: "t-acme" },
    { ref: "A5", company: "Initech", role: null, stage: "waiting", appliedOn: "2026-09-14", lastUpdateOn: "2026-09-14", nextStep: "follow_up", threadId: null },
  ],
  basis: { applications: 5, earliestTrackedOn: "2026-08-07" },
};

describe("AskApplendium", () => {
  beforeEach(() => askApplendium.mockReset());

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
    expect(screen.getByText(/Based on 5 tracked applications since Aug 7/)).toBeInTheDocument();
    expect(screen.getByText(/never the text of your emails/)).toBeInTheDocument();
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
