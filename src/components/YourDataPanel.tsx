import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Download, ExternalLink, Loader2, ShieldCheck, Trash2, Unplug } from "lucide-react";

import { Panel } from "@/components/premium/PremiumUI";
import { BUTTON, EYEBROW } from "@/components/premium/tone";
import { apiFetch } from "@/lib/api.js";
import { friendlyErrorMessage } from "@/lib/apiErrors";
import { useAuth } from "@/lib/AuthContext.jsx";
import { cn } from "@/lib/utils";

/**
 * Your data, in Settings (persona review, 2026-10-14). The privacy page promised control ("revoke
 * anytime", deletion) but Settings offered only Sign out, so a nurse who had done HIPAA training
 * found no way to act on it. This panel says plainly what is read and stored, in the same terms as
 * /privacy, and puts the three controls next to it.
 *
 * Export (GET /api/user/export) and Disconnect (POST /api/user/gmail/disconnect) are being added on
 * the backend at the same time. Until they are live they answer 404, which shows "Not available
 * yet" with the manual alternative instead of an error, so this is safe to ship first.
 * Deletion uses the existing DELETE /api/user/account, which requires the account email typed back.
 */

const GOOGLE_PERMISSIONS_URL = "https://myaccount.google.com/permissions";

type Status = { tone: "ok" | "error" | "info"; text: string } | null;

// Duck-typed so it holds for any ApiRequestError, including in tests that mock the API module.
const isNotAvailable = (error: unknown) => (error as { status?: number } | null)?.status === 404;

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <p
      role={status.tone === "error" ? "alert" : "status"}
      className={cn(
        "mt-2 text-[13px] leading-snug",
        status.tone === "ok" ? "text-success" : status.tone === "error" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {status.text}
    </p>
  );
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function YourDataPanel() {
  const { user } = useAuth();
  return <YourDataAccount key={user?.uid || user?.email || "signed-out"} />;
}

function YourDataAccount() {
  const { user, logout } = useAuth() as { user?: { email?: string | null } | null; logout: () => Promise<void> };
  const navigate = useNavigate();
  const accountEmail = String(user?.email || "").trim();

  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<Status>(null);

  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectStatus, setDisconnectStatus] = useState<Status>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [typedEmail, setTypedEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<Status>(null);
  const deleteConfirmed = accountEmail !== "" && typedEmail.trim().toLowerCase() === accountEmail.toLowerCase();

  const requests = useRef(new Map<string, AbortController>());
  useEffect(() => () => { requests.current.forEach(controller => controller.abort()); }, []);
  function begin(channel: string) {
    if (requests.current.has(channel)) return null;
    const controller = new AbortController(); requests.current.set(channel, controller);
    return controller;
  }

  async function exportData() {
    const request = begin("export"); if (!request) return;
    setExporting(true);
    setExportStatus(null);
    try {
      const data = await apiFetch("/api/user/export", { method: "GET", timeoutMs: 60_000, signal: request.signal });
      if (request.signal.aborted) return;
      const day = new Date().toISOString().slice(0, 10);
      downloadJson(data, `applendium-data-${day}.json`);
      setExportStatus({ tone: "ok", text: "Your data was downloaded as a JSON file." });
    } catch (error) {
      if (request.signal.aborted) return;
      setExportStatus(
        isNotAvailable(error)
          ? { tone: "info", text: "Not available yet. Export is coming soon." }
          : { tone: "error", text: friendlyErrorMessage(error, "The export did not complete. Try again.") },
      );
    } finally {
      requests.current.delete("export");
      if (!request.signal.aborted) setExporting(false);
    }
  }

  async function disconnectGmail() {
    const request = begin("disconnect"); if (!request) return;
    setDisconnecting(true);
    setDisconnectStatus(null);
    try {
      await apiFetch("/api/user/gmail/disconnect", { method: "POST", body: {}, signal: request.signal });
      if (request.signal.aborted) return;
      setConfirmDisconnect(false);
      setDisconnectStatus({
        tone: "ok",
        text: "Gmail is disconnected. New emails stop coming in. What is already here stays until you delete your account.",
      });
    } catch (error) {
      if (request.signal.aborted) return;
      setConfirmDisconnect(false);
      setDisconnectStatus(
        isNotAvailable(error)
          ? { tone: "info", text: "Not available yet. You can remove Applendium's access now on your Google account page." }
          : { tone: "error", text: friendlyErrorMessage(error, "Gmail was not disconnected. Try again.") },
      );
    } finally {
      requests.current.delete("disconnect");
      if (!request.signal.aborted) setDisconnecting(false);
    }
  }

  async function deleteAccount() {
    if (!deleteConfirmed || deleting) return;
    const request = begin("delete"); if (!request) return;
    setDeleting(true);
    setDeleteStatus(null);
    try {
      const response = await apiFetch("/api/user/account", { method: "DELETE", body: { confirmEmail: typedEmail.trim() }, signal: request.signal, timeoutMs: 60_000 });
      if (request.signal.aborted) return;
      if (response?.success !== true) throw new Error("Account deletion could not be confirmed. Please retry or contact support.");
      const billingPending = response?.billingCleanup?.status === "pending";
      const gmailPending = response?.gmailCleanup?.status === "pending";
      if (billingPending || gmailPending) {
        const details = [billingPending ? "Billing cleanup is still pending; contact support to confirm that future charges have stopped." : "",
          gmailPending ? "Google access revocation could not be confirmed. Remove Applendium on your Google permissions page." : ""].filter(Boolean).join(" ");
        toast.warning(`Your account data is deleted. ${details}`, { duration: 20000,
          ...(gmailPending ? { action: { label: "Google permissions", onClick: () => window.open(GOOGLE_PERMISSIONS_URL, "_blank", "noopener,noreferrer") } } : {}) });
      } else {
        toast.success("Your account and stored application data are deleted.");
      }
      try {
        await logout();
      } catch {
        // The account is gone either way; a failed local sign-out must not hide that.
      }
      if (!request.signal.aborted) navigate("/", { replace: true });
    } catch (error) {
      if (request.signal.aborted) return;
      setDeleteStatus({ tone: "error", text: friendlyErrorMessage(error, "Account deletion could not be confirmed. Some steps may have completed. Please retry or contact support.") });
      setDeleting(false);
    } finally { requests.current.delete("delete"); }
  }

  return (
    <Panel title="Your data" icon={ShieldCheck} id="your-data" description="What Applendium reads and keeps, and how to take it with you or remove it.">
      <div className="space-y-5">
        <ul className="space-y-2 text-[13px] leading-relaxed text-foreground/85" data-testid="data-facts">
          <li>Applendium reads your Gmail only after you allow it, to find applications, replies, interviews and decisions.</li>
          <li>
            It stores each application's company, role, status and dates. Email subjects, senders, message text and your
            resumes are encrypted before they are stored.
          </li>
          <li>Your data is never sold or used for advertising. The AI features never receive the text of your emails.</li>
        </ul>
        <Link to="/privacy" className={BUTTON.link}>
          Read the privacy policy
        </Link>

        <div className="grid gap-4 border-t border-border pt-4">
          <div>
            <p className={EYEBROW}>Export</p>
            <p className="mt-1 text-[13px] text-muted-foreground">Download your tracked applications and settings as a JSON file.</p>
            <button type="button" className={cn(BUTTON.secondary, "mt-2")} onClick={() => void exportData()} disabled={exporting}>
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
              {exporting ? "Preparing…" : "Export my data"}
            </button>
            <StatusLine status={exportStatus} />
          </div>

          <div>
            <p className={EYEBROW}>Gmail connection</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Disconnecting stops Applendium from reading new email. You can also remove access on your{" "}
              <a href={GOOGLE_PERMISSIONS_URL} target="_blank" rel="noreferrer" className="font-semibold text-foreground underline underline-offset-2">
                Google account page
                <ExternalLink className="ml-0.5 inline h-3 w-3" aria-hidden />
              </a>
              .
            </p>
            {confirmDisconnect ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={BUTTON.primary} onClick={() => void disconnectGmail()} disabled={disconnecting}>
                  {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Unplug className="h-3.5 w-3.5" aria-hidden />}
                  Yes, disconnect Gmail
                </button>
                <button type="button" className={BUTTON.secondary} onClick={() => setConfirmDisconnect(false)} disabled={disconnecting}>
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" className={cn(BUTTON.secondary, "mt-2")} onClick={() => setConfirmDisconnect(true)}>
                <Unplug className="h-3.5 w-3.5" aria-hidden />
                Disconnect Gmail
              </button>
            )}
            <StatusLine status={disconnectStatus} />
          </div>

          <div>
            <p className={EYEBROW}>Delete account</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Deletes your account, tracked applications, resumes and settings, and requests Google access revocation and
              billing closure. You will be told if either provider step is unconfirmed. This cannot be undone.
            </p>
            {deleteOpen ? (
              <div className="mt-2 max-w-md space-y-2">
                <label htmlFor="delete-confirm-email" className="block text-[13px] font-medium text-foreground">
                  Type your account email{accountEmail ? ` (${accountEmail})` : ""} to confirm
                </label>
                <input
                  id="delete-confirm-email"
                  type="email"
                  autoComplete="off"
                  value={typedEmail}
                  onChange={(event) => setTypedEmail(event.target.value)}
                  className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-[15px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={cn(BUTTON.primary, "bg-destructive hover:bg-destructive/90")}
                    disabled={!deleteConfirmed || deleting}
                    onClick={() => void deleteAccount()}
                  >
                    {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Trash2 className="h-3.5 w-3.5" aria-hidden />}
                    Delete my account
                  </button>
                  <button
                    type="button"
                    className={BUTTON.secondary}
                    disabled={deleting}
                    onClick={() => {
                      setDeleteOpen(false);
                      setTypedEmail("");
                      setDeleteStatus(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className={cn(BUTTON.secondary, "mt-2 text-destructive")} onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Delete my account
              </button>
            )}
            <StatusLine status={deleteStatus} />
          </div>
        </div>
      </div>
    </Panel>
  );
}
