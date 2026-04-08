import { AdminDebugDisabledNotice } from "@/components/AdminDebugDisabledNotice";
import { AdminLayout } from "@/components/AdminLayout";
import { AdminReviewQueue } from "@/components/AdminReviewQueue";
import { useAuth } from "@/lib/AuthContext.jsx";

export default function AdminReview() {
  const { debugRoutesEnabled } = useAuth();

  return (
    <AdminLayout>
      <div className="w-full min-w-0 space-y-6 overflow-x-hidden">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Review Queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review misclassification reports, correct bad user corrections, and keep the training queue clean.
          </p>
        </div>

        <section className="glass-card rounded-xl p-4">
          <p className="text-sm font-medium text-foreground">Review workflow</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep new reports in <span className="font-medium text-foreground">pending</span> until the correction is
            verified. If the user picked the wrong target category, fix the correction in the report drawer before
            approving it.
          </p>
        </section>

        {!debugRoutesEnabled ? <AdminDebugDisabledNotice /> : <AdminReviewQueue />}
      </div>
    </AdminLayout>
  );
}
