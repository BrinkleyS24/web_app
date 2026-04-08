import { useState } from "react";
import { Database, Loader2, RefreshCw, Wrench } from "lucide-react";

import { AdminDebugDisabledNotice } from "@/components/AdminDebugDisabledNotice";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext.jsx";

export default function AdminJobs() {
  const { debugRoutesEnabled } = useAuth();
  const [actionBusy, setActionBusy] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [companyBackfillLimit, setCompanyBackfillLimit] = useState("500");
  const [applicationBackfillLimit, setApplicationBackfillLimit] = useState("500");

  async function runAction(actionKey: string, runner: () => Promise<any>) {
    setActionBusy(actionKey);
    setActionMessage("");
    try {
      const result = await runner();
      setActionMessage(result?.message || `Completed ${actionKey.replace(/-/g, " ")} successfully.`);
    } catch (err: any) {
      setActionMessage(err?.message || `Failed to run ${actionKey}.`);
    } finally {
      setActionBusy("");
    }
  }

  return (
    <AdminLayout>
      <div className="w-full min-w-0 space-y-6 overflow-x-hidden">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Jobs And Repair Tools</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Operational tools that mutate stored data live here instead of the review queue.
          </p>
        </div>

        {!debugRoutesEnabled ? (
          <AdminDebugDisabledNotice />
        ) : (
          <section className="glass-card rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-accent" />
              <h2 className="text-base font-semibold text-foreground">Repair Tools</h2>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <div className="rounded-xl border border-border bg-background/70 p-4 space-y-3">
                <p className="text-sm font-medium text-foreground">Company / Position Backfill</p>
                <Input
                  type="number"
                  min={1}
                  max={5000}
                  value={companyBackfillLimit}
                  onChange={(event) => setCompanyBackfillLimit(event.target.value)}
                />
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={actionBusy === "company-backfill"}
                  onClick={() => runAction("company-backfill", () => apiFetch("/api/emails/company-position/backfill", {
                    method: "POST",
                    body: {
                      limit: Number(companyBackfillLimit || 500),
                      all: false,
                      relink: true,
                    },
                  }))}
                >
                  {actionBusy === "company-backfill" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                  Run Backfill
                </Button>
              </div>

              <div className="rounded-xl border border-border bg-background/70 p-4 space-y-3">
                <p className="text-sm font-medium text-foreground">Application Link Backfill</p>
                <Input
                  type="number"
                  min={1}
                  max={5000}
                  value={applicationBackfillLimit}
                  onChange={(event) => setApplicationBackfillLimit(event.target.value)}
                />
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={actionBusy === "application-backfill"}
                  onClick={() => runAction("application-backfill", () => apiFetch("/api/emails/applications/backfill", {
                    method: "POST",
                    body: {
                      limit: Number(applicationBackfillLimit || 500),
                    },
                  }))}
                >
                  {actionBusy === "application-backfill" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                  Repair Links
                </Button>
              </div>

              <div className="rounded-xl border border-border bg-background/70 p-4 space-y-3">
                <p className="text-sm font-medium text-foreground">Role Normalization Cache</p>
                <p className="text-sm text-muted-foreground">
                  Clear the normalization cache when you want fresh role-family grouping during debugging.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={actionBusy === "clear-role-cache"}
                  onClick={() => runAction("clear-role-cache", () => apiFetch("/api/emails/normalize-roles/cache", {
                    method: "DELETE",
                  }))}
                >
                  {actionBusy === "clear-role-cache" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Clear Cache
                </Button>
              </div>
            </div>

            {actionMessage ? (
              <p className="text-sm text-muted-foreground">{actionMessage}</p>
            ) : null}
          </section>
        )}
      </div>
    </AdminLayout>
  );
}
