import { AskApplendium } from "@/components/AskApplendium";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/premium/PremiumUI";

/**
 * Ask Applendium's own page (2026-10-14). It existed only as a card on the Dashboard, so the nav had
 * no way to it. The dedicated workspace uses the same request/owner protections;
 * the Dashboard retains its embedded presentation until its separate redesign.
 */
export default function AskPage() {
  return (
    <DashboardLayout>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Your tracked applications"
          title="Ask Applendium"
          description="Get a clear answer about your search, with sources you can check."
        />
        <AskApplendium presentation="workspace" />
      </div>
    </DashboardLayout>
  );
}
