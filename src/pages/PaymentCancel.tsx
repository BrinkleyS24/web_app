import React from "react";
import { Link } from "react-router-dom";
import { Clock3 } from "lucide-react";
import PublicSiteLayout from "../components/PublicSiteLayout.jsx";
import usePageMetadata from "../lib/usePageMetadata.js";

export default function PaymentCancel() {
  usePageMetadata({
    title: "Applendium | Checkout Canceled",
    description: "Applendium Premium Beta checkout was canceled.",
  });

  return (
    <PublicSiteLayout>
      <section className="heroSection">
        <div className="heroGrid">
          <div className="heroCopy animate-fade-in">
            <div className="launchBadge">
              <Clock3 aria-hidden="true" />
              <span>Checkout canceled</span>
            </div>
            <h1 className="heroTitle">No payment was completed.</h1>
            <p className="heroLead">
              You can restart Premium Beta checkout whenever you are ready. The beta starts
              with Apply Gate and a weekly search-health summary.
            </p>
            <div className="heroActions">
              <Link className="publicButton publicButtonPrimary" to="/upgrade">
                Return to Premium Beta
              </Link>
              <Link className="publicButton publicButtonSecondary" to="/">
                Back to home
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicSiteLayout>
  );
}
