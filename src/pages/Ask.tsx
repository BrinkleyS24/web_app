import { AskApplendium } from "@/components/AskApplendium";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/premium/PremiumUI";

/**
 * Ask Applendium's own page (2026-10-14). It existed only as a card on the Dashboard, so the nav had
 * no way to it. Same component, so answers and limits are identical in both places.
 */
export default function AskPage() {
  return (
    <DashboardLayout>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Your tracked applications"
          title="Ask Applendium"
          description="Ask about your own applications, replies and interviews. Every application in an answer links back to its email."
        />
        <AskApplendium />
      </div>
    </DashboardLayout>
  );
}
