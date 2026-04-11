import {
  Bell,
  Brain,
  FileText,
  Inbox,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";

export const premiumUpdatesHref =
  "mailto:support@applendium.com?subject=Applendium%20Premium%20Updates";

export const heroFactItems = [
  {
    label: "Access",
    value: "Read-only Gmail",
    body:
      "The extension asks for Gmail read-only access so users can review tracked applications without granting send-mail permission.",
  },
  {
    label: "Pipeline",
    value: "Applied to rejected",
    body:
      "The popup groups job-application emails by stage so users can scan interviews, offers, and rejections in one place.",
  },
  {
    label: "Workflow",
    value: "Search, refresh, review",
    body:
      "Users can search companies and roles, refresh from the popup, and open a thread to review the application journey.",
  },
];

export function getLaunchStatusItems(isExtensionLive) {
  return [
    {
      icon: Inbox,
      state: isExtensionLive ? "Live now" : "In review",
      title: "Chrome extension",
      body: isExtensionLive
        ? "Install the Chrome extension, sign in with Google, and start tracking job-application emails directly from Gmail."
        : "The first Applendium release is in Chrome Web Store review. Once approved, users will install it from the listing and launch it from the Chrome toolbar.",
    },
    {
      icon: ShieldCheck,
      state: isExtensionLive ? "Live now" : "Ready at launch",
      title: "Read-only Gmail access",
      body:
        "The extension uses Gmail read-only access so users can review application history without granting send-mail permission.",
    },
    {
      icon: LayoutDashboard,
      state: isExtensionLive ? "Coming soon" : "Closed for now",
      title: "Premium dashboard",
      body:
        "Advanced review workflows and premium analytics stay intentionally closed until the paid dashboard can support a complete public release.",
    },
  ];
}

export const availableNowItems = [
  {
    title: "Sign in from the popup",
    body:
      "Users start in the Chrome toolbar, sign in with Google, and connect the Gmail account they already use for applications.",
  },
  {
    title: "Track applications by stage",
    body:
      "The popup groups job-application emails into Applied, Interviews, Offers, and Rejected so the pipeline is readable at a glance.",
  },
  {
    title: "Search and review thread history",
    body:
      "Users can search companies and roles from the popup, then open a thread to inspect the application journey without losing context.",
  },
  {
    title: "Clear privacy and support surface",
    body:
      "Applendium.com stays live for support, privacy details, and launch communication while premium workflows remain intentionally gated.",
  },
];

export const premiumFeatureCards = [
  {
    icon: ShieldCheck,
    title: "Apply Gate",
    body:
      "Run one pre-apply decision brief that combines fit review, likely rejection risks, and fix-first guidance before you spend time applying.",
  },
  {
    icon: Wrench,
    title: "Daily Action Queue",
    body:
      "Prioritize the next few follow-ups, ghosting checks, resume-proof fixes, and cleanup actions with a clear reason behind each move.",
  },
  {
    icon: Brain,
    title: "Outcome Memory",
    body:
      "Track repeated misses and evidence gaps across applications so the dashboard can surface what keeps happening.",
  },
  {
    icon: Bell,
    title: "Strategy Alerts",
    body:
      "Surface high-confidence warnings when your search pattern looks weak, noisy, stalled, or off target.",
  },
  {
    icon: FileText,
    title: "Weekly Summary",
    body:
      "Package the week into a shorter premium digest that highlights what changed and what deserves attention next.",
  },
];

export function getRolloutSteps(isExtensionLive) {
  return isExtensionLive
    ? [
        {
          step: "01",
          phase: "Install",
          title: "Install the Chrome extension",
          body:
            "Add Applendium to Chrome and launch it from the toolbar instead of starting from a manual spreadsheet or notes app.",
        },
        {
          step: "02",
          phase: "Sign in",
          title: "Connect Gmail with read-only access",
          body:
            "Sign in with Google and let the extension read job-application emails so it can classify and group them without send-mail access.",
        },
        {
          step: "03",
          phase: "Review",
          title: "Review your search from the popup",
          body:
            "Search companies and roles, refresh from the popup, and open a thread to see how one application moved through the pipeline.",
        },
      ]
    : [
        {
          step: "01",
          phase: "Review",
          title: "Open the Chrome Store listing",
          body:
            "Use the listing to understand the product, privacy scope, and launch status while the first release is still in review.",
        },
        {
          step: "02",
          phase: "Install",
          title: "Install once the listing is approved",
          body:
            "After approval, add Applendium to Chrome and launch it from the toolbar instead of starting from a manual spreadsheet or notes app.",
        },
        {
          step: "03",
          phase: "Track",
          title: "Sign in and review from the popup",
          body:
            "Connect Gmail with read-only access, then search, refresh, and review the application pipeline from the popup.",
        },
      ];
}

export const upgradeStatusCards = [
  {
    icon: Sparkles,
    title: "Why checkout is disabled",
    body:
      "Premium stays closed until the dashboard experience is ready to support real users end to end.",
  },
  {
    icon: LayoutDashboard,
    title: "What is still in build",
    body:
      "Dashboard review flows, premium analytics, and the paid experience are being finished before launch.",
  },
  {
    icon: ShieldCheck,
    title: "What stays available",
    body:
      "The extension, support surface, and account access remain available while premium is staged behind the scenes.",
  },
];
