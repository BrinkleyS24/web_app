import {
  Bell,
  Brain,
  FileText,
  Inbox,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";

export const premiumUpdatesHref =
  "mailto:support@applendium.com?subject=Applendium%20Premium%20Updates";

export const launchStatusItems = [
  {
    icon: Inbox,
    state: "Available now",
    title: "Chrome extension",
    body:
      "Install the extension, connect Gmail, and start turning application emails into a cleaner search record.",
  },
  {
    icon: ShieldCheck,
    state: "Available now",
    title: "Public support surface",
    body:
      "Privacy, support, and launch-status pages stay live on applendium.com for users and store reviewers.",
  },
  {
    icon: LayoutDashboard,
    state: "Coming soon",
    title: "Premium dashboard",
    body:
      "Advanced review workflows and premium analytics stay closed until the dashboard is polished and release-ready.",
  },
];

export const availableNowItems = [
  {
    title: "Extension-first onboarding",
    body:
      "Users can install the Chrome extension, sign in, and connect the Gmail account they already use for applications.",
  },
  {
    title: "Clear public documentation",
    body:
      "The main site remains the public source for privacy details, support contact, and product-status communication.",
  },
  {
    title: "Controlled web access",
    body:
      "The companion app can stay online for account access and staged rollout support without pretending premium is already open.",
  },
];

export const premiumFeatureCards = [
  {
    icon: ShieldCheck,
    title: "Apply Gate",
    body:
      "Review jobs before you apply, with premium verdicts and clearer risk framing.",
  },
  {
    icon: Zap,
    title: "Pre-jection Simulator",
    body:
      "Model likely rejection reasons before you spend time on an application.",
  },
  {
    icon: Wrench,
    title: "Fix Suggestions",
    body:
      "Get targeted resume and application edits tied to the job in front of you.",
  },
  {
    icon: Brain,
    title: "Outcome Memory",
    body:
      "Track patterns across applications so the dashboard can surface what keeps happening.",
  },
  {
    icon: Bell,
    title: "Strategy Alerts",
    body:
      "Receive premium nudges when your search pattern looks weak, noisy, or off target.",
  },
  {
    icon: FileText,
    title: "Weekly Summary",
    body:
      "See a cleaner premium digest of what changed and what deserves attention next.",
  },
];

export const rolloutSteps = [
  {
    step: "01",
    phase: "Now",
    title: "Launch the extension first",
    body:
      "Ship the inbox-based product surface and public trust pages without overpromising unfinished dashboard workflows.",
  },
  {
    step: "02",
    phase: "Now",
    title: "Keep the site explicit",
    body:
      "Use applendium.com to set expectations, answer support questions, and explain what is and is not live yet.",
  },
  {
    step: "03",
    phase: "Soon",
    title: "Open premium when ready",
    body:
      "Turn on billing and dashboard access only after the review flow, polish, and reliability meet the release bar.",
  },
];

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
