import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";
import { AskApplendium } from "./AskApplendium";
import type { AskResponse } from "@/lib/ask";
import { askResultRows, orderAskRows } from "@/lib/askResults";
import { ApiRequestError } from "@/lib/api";

const state = vi.hoisted(() => ({ owner: "workspace-a", ask: vi.fn() }));
vi.mock("@/lib/AuthContext.jsx", () => ({ useAuth: () => ({ user: state.owner ? { uid: state.owner } : null }) }));
vi.mock("@/lib/ask", async () => ({ ...await vi.importActual("@/lib/ask"), askApplendium: state.ask }));
function mount() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const ui = () => <QueryClientProvider client={client}><MemoryRouter><AskApplendium presentation="workspace" /></MemoryRouter></QueryClientProvider>;
  const view = render(ui()); return { ...view, refresh: () => view.rerender(ui()) };
}
function listAnswer(size = 218): AskResponse {
  const items = Array.from({ length: size }, (_, i) => ({ ref: `R${i}`, company: `Company ${String(i).padStart(3, "0")}`, role: "Engineer", stage: "quiet" as const, appliedOn: "2026-01-01", lastUpdateOn: "2026-01-01", daysSinceLastUpdate: 300 - i, threadId: `thread-${i}` }));
  return { success: true, answerKind: "list", answer: `${size} applications have had no reply.\n${items.map(x => x.company).join("\n")}`, answerLines: [`${size} applications have had no reply.`, ...items.map(x => x.company)], applications: [], list: { kind: "no_reply", total: size, minDays: 14, items } };
}
async function ask() { await userEvent.click(screen.getByRole("button", { name: "Who hasn't replied in 2 weeks?" })); }
beforeEach(() => { state.owner = "workspace-a"; state.ask.mockReset(); });

test("a large complete list starts with five rows and keeps its total, all matches and sources reachable", async () => {
  state.ask.mockResolvedValue(listAnswer()); mount(); await ask();
  expect(await screen.findByRole("heading", { name: "218 applications with no tracked reply" })).toBeVisible();
  expect(screen.getAllByTestId("ask-result-row")).toHaveLength(5);
  expect(screen.getByText("1–5 of 218 applications")).toBeVisible();
  expect(screen.getByRole("link", { name: /See prioritized next actions/ })).toHaveAttribute("href", "/next-actions");
  await userEvent.type(screen.getByRole("searchbox"), "Company 217");
  expect(screen.getAllByTestId("ask-result-row")).toHaveLength(1);
  expect(screen.getByRole("link", { name: "Open in Gmail" })).toHaveAttribute("href", "https://mail.google.com/mail/u/0/#all/thread-217");
  expect(state.ask).toHaveBeenCalledTimes(1);
});

test("paging focuses the list and filtering on a later page cannot create a false empty result", async () => {
  state.ask.mockResolvedValue(listAnswer(12)); mount(); await ask(); await screen.findByText("1–5 of 12 applications");
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText("6–10 of 12 applications")).toBeVisible();
  expect(screen.getByRole("heading", { name: "Applications in this answer" })).toHaveFocus();
  await userEvent.type(screen.getByRole("searchbox"), "Company 000");
  expect(screen.getByText("1–1 of 1 filtered results · 12 in this answer")).toBeVisible();
  await userEvent.clear(screen.getByRole("searchbox")); await userEvent.type(screen.getByRole("searchbox"), "missing");
  expect(screen.getByText("No company or role matches your filter.")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Clear filter" }));
  expect(screen.getByText("1–5 of 12 applications")).toBeVisible();
});

test("sort order is explicit and source joins never use an employer name", () => {
  const result = listAnswer(2); result.list!.items[0].company = result.list!.items[1].company = "Same employer";
  result.list!.items[0].lastUpdateOn = null; result.list!.items[0].appliedOn = null;
  result.list!.items[1].lastUpdateOn = "2026-11-01";
  result.applications = [{ ref: "other-ref", company: "Same employer", role: "Engineer", stage: "waiting", threadId: "wrong-thread", appliedOn: null, lastUpdateOn: null, nextStep: null }];
  const rows = askResultRows(result);
  expect(rows).toHaveLength(3); expect(rows[0].citation).toBeUndefined();
  expect(orderAskRows(rows, "", "recent").map(x => x.ref)).toEqual(["R1", "R0", "other-ref"]);
  expect(orderAskRows(rows, "", "longest").map(x => x.ref)).toEqual(["R0", "R1", "other-ref"]);
});

test("an older API retains every row and explicitly lacks links beyond its citation cap", async () => {
  const response = listAnswer(60); delete response.answerKind;
  response.list!.items.forEach(x => { delete x.threadId; });
  state.ask.mockResolvedValue(response); mount(); await ask(); await screen.findByRole("heading", { name: "Your answer" });
  await userEvent.type(screen.getByRole("searchbox"), "Company 059");
  expect(screen.getByText("Email link unavailable")).toBeVisible();
  expect(screen.queryByRole("link", { name: "Open in Gmail" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByText(/Read the full answer/));
  expect(screen.getAllByText("Company 059").length).toBeGreaterThan(0);
});

test("compound answers retain extra cited applications, the narrative and unanswerable parts", async () => {
  const response = listAnswer(2); response.answerKind = "compound";
  response.answerLines = ["You reached 7 interviews.", "Two applications have no reply.", "Both listed below."];
  response.unansweredQuestions = ["Why did the employer reject me?"];
  response.applications = [{ ref: "outside-list", company: "Another application", role: null, stage: "offer", appliedOn: null, lastUpdateOn: null, nextStep: null, threadId: "outside-thread" }];
  state.ask.mockResolvedValue(response); mount(); await ask();
  expect(await screen.findByText("You reached 7 interviews.")).toBeVisible();
  expect(screen.getByText("Why did the employer reject me?")).toBeVisible();
  expect(screen.getAllByTestId("ask-result-row")).toHaveLength(3);
  expect(screen.getByText("Another application")).toBeVisible();
});

test.each([
  { known: false, expected: "Invited Oct 1, 2026 · Interview cancelled" },
  { known: true, expected: "Interview Oct 1, 2026 · Next interview cancelled" },
  { known: null, expected: "Interview-stage evidence Oct 1, 2026 · Cancellation recorded" },
])("invitation and cancellation metadata preserve uncertainty: $expected", async ({ known, expected }) => {
  state.ask.mockResolvedValue({ success: true, answer: "One interview", answerKind: "list", applications: [], list: { kind: "reached_interview", total: 1, items: [{ ref: "I1", company: "Example", role: null, interviewedOn: "2026-10-01", interviewDateKnown: known, interviewStatus: "cancelled", stage: "rejected", threadId: null }] } });
  mount(); await ask();
  expect(await screen.findByText(expected)).toBeVisible();
  expect(screen.getByText("Role not identified")).toBeVisible(); expect(screen.getByText("Rejected")).toBeVisible();
});

test("zero matching applications has an explicit result and no empty list controls", async () => {
  state.ask.mockResolvedValue(listAnswer(0)); mount(); await ask();
  expect(await screen.findByText("No applications match this request in your tracked history.")).toBeVisible();
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
});

test("a long single-paragraph answer is bounded initially and remains available in full", async () => {
  const paragraph = "Review your tracked results carefully. ".repeat(120);
  state.ask.mockResolvedValue({ success: true, answer: paragraph, applications: [] }); mount(); await ask();
  await screen.findByRole("heading", { name: "Your answer" });
  const complete = screen.getByText(paragraph.trim()); expect(complete).not.toBeVisible();
  await userEvent.click(screen.getByText("Read the full answer")); expect(complete).toBeVisible();
});

test("request failure preserves the question for editing and retry", async () => {
  state.ask.mockRejectedValueOnce(new Error("Service unavailable")).mockResolvedValueOnce(listAnswer(0)); mount(); await ask();
  expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't answer that question");
  await userEvent.click(screen.getByRole("button", { name: "Edit question" }));
  expect(screen.getByLabelText("Your question")).toHaveValue("Who hasn't replied in 2 weeks?");
  expect(screen.getByLabelText("Your question")).toHaveFocus();
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByText("No applications match this request in your tracked history."); expect(state.ask).toHaveBeenCalledTimes(2);
});

test("an AI quota outage offers deterministic lookups instead of a futile retry", async () => {
  state.ask.mockRejectedValueOnce(new ApiRequestError("AI answers are currently unavailable.", { status: 503, payload: { recovery: "tracked_lookups" } })).mockResolvedValueOnce(listAnswer(0));
  mount(); await ask(); await screen.findByRole("alert");
  expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Find unanswered applications" }));
  await screen.findByText("No applications match this request in your tracked history.");
  expect(state.ask.mock.calls[1][0]).toBe("Who hasn't replied in 2 weeks?");
});

test("a pending question cannot be submitted twice or show a previous owner's late response", async () => {
  let resolve!: (value: AskResponse) => void;
  state.ask.mockImplementation(() => new Promise(r => { resolve = r; })); const view = mount();
  await userEvent.type(screen.getByLabelText("Your question"), "Anything new?{Enter}{Enter}");
  expect(screen.getByTestId("ask-thinking")).toBeVisible(); expect(state.ask).toHaveBeenCalledTimes(1);
  const signal = state.ask.mock.calls[0][1].signal;
  state.owner = "workspace-b"; view.refresh(); expect(signal.aborted).toBe(true);
  await act(async () => { resolve({ success: true, answer: "PRIVATE_LATE_ANSWER", applications: [] }); });
  expect(screen.queryByText("PRIVATE_LATE_ANSWER")).not.toBeInTheDocument();
});

test("asking another question resets the previous result and Shift+Enter does not submit", async () => {
  state.ask.mockResolvedValueOnce(listAnswer(12)).mockResolvedValueOnce(listAnswer(0)); mount(); await ask();
  await screen.findByText("1–5 of 12 applications"); await userEvent.click(screen.getByRole("button", { name: "Next" }));
  await userEvent.click(screen.getByRole("button", { name: "Ask another question" }));
  const input = screen.getByLabelText("Your question"); expect(input).toHaveFocus();
  await userEvent.type(input, "Any updates?{Shift>}{Enter}{/Shift}"); expect(state.ask).toHaveBeenCalledTimes(1);
  await userEvent.type(input, "{Enter}"); await screen.findByText("No applications match this request in your tracked history.");
  expect(screen.queryByTestId("ask-result-row")).not.toBeInTheDocument(); expect(screen.queryByLabelText("Your question")).not.toBeInTheDocument();
});

test("assessment requests stay visible, quotes are linked to their exact application and plain text stays inert", async () => {
  state.ask.mockResolvedValue({ success: true, answer: "Review the assessment request.", applications: [{ ref: "Q1", company: "Example", role: "Analyst", stage: "waiting", appliedOn: null, lastUpdateOn: null, nextStep: "complete_assessment", threadId: "q1" }], quotes: [{ ref: "Q1", company: "Example", role: "Analyst", kind: "assessment", date: "2026-11-01", passage: '<img src=x onerror="alert(1)"> Please finish the exercise.', threadId: "q1" }] });
  mount(); await ask(); await screen.findByText("Finish the assessment");
  const row = screen.getByTestId("ask-result-row"); await userEvent.click(within(row).getByText(/What Example wrote/));
  expect(within(row).getByText(/<img src=x/)).toBeVisible(); expect(row.querySelector("img")).toBeNull();
});

test("resume-outcome handoffs preserve unknown attribution and disclose their actual source", async () => {
  state.ask.mockResolvedValue({ success: true, answer: "The submitted version is unknown.", applications: [], handoff: { kind: "resumes", label: "Review confirmed resume outcomes", source: "confirmed_resume_outcomes" } });
  mount(); await ask(); expect(await screen.findByText("The submitted version is unknown.")).toBeVisible();
  expect(screen.getByRole("link", { name: /Review confirmed resume outcomes/ })).toHaveAttribute("href", "/resumes");
  await userEvent.click(screen.getByText("About this answer")); expect(screen.getByText(/Uses confirmed resume submissions/)).toBeVisible();
});
