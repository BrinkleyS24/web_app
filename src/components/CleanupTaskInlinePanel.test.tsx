import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { CleanupTaskInlinePanel } from "./CleanupTaskInlinePanel";
import type { QueueItem } from "@/lib/premiumTaskQueue";

const mocks = vi.hoisted(() => ({ link: vi.fn(), company: vi.fn(), position: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/emails", () => ({ linkRoleEmails: mocks.link, updateEmailCompany: mocks.company, updateEmailPosition: mocks.position }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error, message: vi.fn() } }));

const task = { id: "cleanup:application-links", actionType: "cleanup_application_links" } as QueueItem;
const emails = [{ id: "1", thread_id: "t1", category: "Interviewed", date: new Date().toISOString(), company_name: "Acme", position: "Engineer", applicationId: null }];

describe("application link repair", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  test("reports partial link failure without claiming the application is linked", async () => {
    mocks.link.mockResolvedValue({ success: true, relinked: 1, failed: 1 });
    render(<CleanupTaskInlinePanel task={task} storedEmails={emails} onRefresh={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Link journey" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("could not be confirmed")));
    expect(mocks.success).not.toHaveBeenCalled();
  });

  test("distinguishes a successful write from a failed refresh", async () => {
    mocks.link.mockResolvedValue({ success: true, relinked: 1, failed: 0 });
    render(<CleanupTaskInlinePanel task={task} storedEmails={emails} onRefresh={vi.fn().mockRejectedValue(new Error("offline"))} />);
    await userEvent.click(screen.getByRole("button", { name: "Link journey" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("Links updated")));
    expect(mocks.success).not.toHaveBeenCalled();
  });

  test("does not treat a failed email load as a cleared task", () => {
    render(<CleanupTaskInlinePanel task={task} storedEmails={[]} loadError="Email loading failed" onRefresh={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Email loading failed");
    expect(screen.getByRole("button", { name: "Retry loading emails" })).toBeVisible();
    expect(screen.queryByText(/already clear/i)).not.toBeInTheDocument();
  });

  test("serializes link requests across rows while one write is pending", async () => {
    let finish!: (value: unknown) => void;
    mocks.link.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    render(<CleanupTaskInlinePanel task={task} storedEmails={[...emails, { ...emails[0], id: "2", thread_id: "t2" }]} onRefresh={vi.fn().mockResolvedValue(undefined)} />);
    const buttons = screen.getAllByRole("button", { name: "Link journey" });
    await userEvent.click(buttons[0]);
    expect(buttons[1]).toBeDisabled();
    await userEvent.click(buttons[1]);
    expect(mocks.link).toHaveBeenCalledTimes(1);
    finish({ success: true, relinked: 1, failed: 0 });
    await waitFor(() => expect(buttons[1]).toBeEnabled());
  });

  test("reports saved details when subsequent relinking fails", async () => {
    mocks.company.mockResolvedValue({ success: true });
    mocks.link.mockRejectedValue(new Error("Linking unavailable"));
    render(<CleanupTaskInlinePanel task={{ ...task, actionType: "cleanup_structured_fields" }} storedEmails={[{ ...emails[0], company_name: null }]} onRefresh={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText("Company"), "Acme");
    await userEvent.click(screen.getByRole("button", { name: "Save and relink" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Some details were saved. Linking unavailable"));
    expect(mocks.success).not.toHaveBeenCalled();
  });
});
