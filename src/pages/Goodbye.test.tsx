import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { submitUninstallAnswer } = vi.hoisted(() => ({ submitUninstallAnswer: vi.fn() }));
vi.mock("../lib/activity", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/activity")>()),
  submitUninstallAnswer,
}));
vi.mock("../lib/usePageMetadata.js", () => ({ default: () => {} }));

import Goodbye from "./Goodbye.jsx";

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Goodbye />
    </MemoryRouter>,
  );
}

describe("Goodbye (uninstall survey)", () => {
  beforeEach(() => submitUninstallAnswer.mockReset().mockResolvedValue(undefined));

  it("asks one optional question with every offered reason, and needs a choice to send", () => {
    renderAt("/goodbye");
    expect(screen.getByRole("heading", { name: "Sorry to see you go" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(6);
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("sends the answer with the version, sign-in flag and account key from the uninstall link", async () => {
    renderAt("/goodbye?v=2.1.7&si=1&uk=0123456789abcdef");
    fireEvent.click(screen.getByLabelText("The Google security warning worried me"));
    fireEvent.change(screen.getByLabelText(/Anything else/), { target: { value: "  scary screen  " } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getByTestId("goodbye-thanks")).toBeInTheDocument());
    expect(submitUninstallAnswer).toHaveBeenCalledWith({
      reason: "google_warning", note: "scary screen", uk: "0123456789abcdef", v: "2.1.7", si: "1",
    });
  });

  it("works for someone who never signed in, and congratulates a new job", async () => {
    renderAt("/goodbye?v=2.1.7&si=0");
    fireEvent.click(screen.getByLabelText("I got a job"));
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getByText("Congratulations on the new job.")).toBeInTheDocument());
    expect(submitUninstallAnswer).toHaveBeenCalledWith(expect.objectContaining({ reason: "found_job", uk: null, si: "0" }));
  });

  it("says so when the answer did not send, and lets them try again", async () => {
    submitUninstallAnswer.mockRejectedValueOnce(new Error("offline"));
    renderAt("/goodbye");
    fireEvent.click(screen.getByLabelText("Too many notifications"));
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("That didn't send"));
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  // 2026-10-14 persona findings: the question lacked its "?", and nothing told someone who just
  // uninstalled how to revoke Gmail access or delete what is stored.
  it("asks the question with a question mark", () => {
    renderAt("/goodbye");
    expect(screen.getByText(/Why did you remove Applendium™\? One click helps us/)).toBeInTheDocument();
  });

  it("tells a leaver how to revoke Gmail access and delete their data, before and after answering", async () => {
    renderAt("/goodbye");
    const block = screen.getByTestId("goodbye-your-data");
    expect(block).toHaveTextContent("does not remove Gmail access or delete what is already stored");
    expect(screen.getByRole("link", { name: "Open Google Account connections" }))
      .toHaveAttribute("href", "https://myaccount.google.com/connections");
    expect(screen.getByRole("link", { name: "privacy@applendium.com" }).getAttribute("href"))
      .toMatch(/^mailto:privacy@applendium\.com/);
    expect(block).toHaveTextContent("Settings > Your data");
    // The page has the public header and footer, so it is not a dead end.
    expect(screen.getByTestId("site-header")).toBeInTheDocument();
    expect(screen.getByTestId("footer-privacy-link")).toHaveAttribute("href", "/privacy");

    fireEvent.click(screen.getByLabelText("I got a job"));
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getByTestId("goodbye-thanks")).toBeInTheDocument());
    expect(screen.getByTestId("goodbye-your-data")).toBeInTheDocument();
  });
});
