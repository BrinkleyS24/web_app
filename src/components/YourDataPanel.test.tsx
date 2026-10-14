import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { YourDataPanel } from "./YourDataPanel";

const { apiFetch, logout, navigate, toastSuccess } = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  logout: vi.fn(),
  navigate: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/lib/api.js", () => ({ apiFetch }));
vi.mock("@/lib/AuthContext.jsx", () => ({ useAuth: () => ({ user: { email: "maria@example.com" }, logout }) }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: vi.fn() } }));
vi.mock("react-router-dom", async () => ({ ...(await vi.importActual("react-router-dom")), useNavigate: () => navigate }));

const notFound = () => Object.assign(new Error("This is not available right now."), { status: 404 });

function renderPanel() {
  return render(
    <MemoryRouter>
      <YourDataPanel />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  logout.mockResolvedValue(undefined);
});
afterEach(() => vi.clearAllMocks());

// Settings had only Sign out: no disconnect, delete or export (mobile persona, 2026-10-14).
describe("YourDataPanel", () => {
  test("says what is read and stored, and links to the privacy policy", () => {
    renderPanel();
    expect(screen.getByTestId("data-facts")).toHaveTextContent("encrypted before they are stored");
    expect(screen.getByTestId("data-facts")).toHaveTextContent("never receive the text of your emails");
    expect(screen.getByRole("link", { name: "Read the privacy policy" })).toHaveAttribute("href", "/privacy");
  });

  test("export downloads JSON from /api/user/export", async () => {
    const user = userEvent.setup();
    apiFetch.mockResolvedValue({ applications: [] });
    const createObjectURL = vi.fn(() => "blob:x");
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    renderPanel();
    await user.click(screen.getByRole("button", { name: "Export my data" }));
    expect(apiFetch).toHaveBeenCalledWith("/api/user/export", expect.objectContaining({ method: "GET" }));
    expect(await screen.findByText("Your data was downloaded as a JSON file.")).toBeInTheDocument();
    expect(createObjectURL).toHaveBeenCalled();
  });

  test("export and disconnect say 'Not available yet' while the backend answers 404", async () => {
    const user = userEvent.setup();
    apiFetch.mockRejectedValue(notFound());
    renderPanel();
    await user.click(screen.getByRole("button", { name: "Export my data" }));
    expect(await screen.findByText(/Not available yet\. Export is coming soon\./)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Disconnect Gmail" }));
    await user.click(screen.getByRole("button", { name: "Yes, disconnect Gmail" }));
    expect(apiFetch).toHaveBeenCalledWith("/api/user/gmail/disconnect", expect.objectContaining({ method: "POST" }));
    expect(await screen.findByText(/Not available yet\. You can remove Applendium's access/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("delete needs the account email typed back, then deletes, signs out and leaves", async () => {
    const user = userEvent.setup();
    apiFetch.mockResolvedValue({ success: true });
    renderPanel();
    await user.click(screen.getByRole("button", { name: "Delete my account" }));
    const confirm = screen.getByRole("button", { name: "Delete my account" });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText(/Type your account email/), "maria@example");
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText(/Type your account email/), ".com");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith("/api/user/account", { method: "DELETE", body: { confirmEmail: "maria@example.com" } }),
    );
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/", { replace: true }));
    expect(logout).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalled();
  });

  test("a failed delete shows a sentence and stays put", async () => {
    const user = userEvent.setup();
    apiFetch.mockRejectedValue(Object.assign(new Error("ACCOUNT_DELETE_FAILED"), { status: 500 }));
    renderPanel();
    await user.click(screen.getByRole("button", { name: "Delete my account" }));
    await user.type(screen.getByLabelText(/Type your account email/), "maria@example.com");
    await user.click(screen.getByRole("button", { name: "Delete my account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("problem on its side");
    expect(screen.queryByText(/ACCOUNT_DELETE_FAILED/)).not.toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });
});
