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

export const launchStatusItems = [
  {
    icon: Inbox,
    state: "Live now",
    title: "Chrome extension",
    body:
      "Install the Chrome extension, sign in with Google, and start tracking job-application emails directly from Gmail.",
  },
  {
    icon: ShieldCheck,
    state: "Live now",
    title: "Read-only Gmail access",
    body:
      "The shipped extension uses Gmail read-only access, so users can review application history without granting send-mail access.",
  },
  {
    icon: LayoutDashboard,
    state: "Coming soon",
    title: "Premium dashboard",
    body:
      "Advanced review workflows and premium analytics stay closed until the paid dashboard can support a complete release.",
  },
];

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
