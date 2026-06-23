import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flag,
  LogOut,
  RefreshCw,
  Search,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";

const MAIN_TABS = [
  { id: "all", label: "All", activeClassName: "bg-accent text-accent-foreground border-transparent" },
  { id: "applied", label: "Applied", activeClassName: "bg-secondary text-primary border-transparent" },
  { id: "interviewed", label: "Interviews", activeClassName: "bg-warning text-white border-transparent" },
  { id: "offers", label: "Offers", activeClassName: "bg-success text-success-foreground border-transparent" },
  { id: "rejected", label: "Rejected", activeClassName: "bg-destructive text-destructive-foreground border-transparent" },
];

const STATUS_LABELS = {
  applied: "Applied",
  interviewed: "Interview",
  offers: "Offer",
  rejected: "Rejected",
  closed: "Closed",
};

const DATE_FILTERS = [
  { key: "all", label: "All" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
];

const DISPLAY_STAGES = [
  {
    key: "applied",
    label: "Applied",
    dotClassName: "border-muted-foreground/60 bg-muted-foreground/60",
    textClassName: "text-muted-foreground",
    lineClassName: "bg-muted-foreground/25",
  },
  {
    key: "interviewed",
    label: "Interview",
    dotClassName: "border-warning bg-warning",
    textClassName: "text-warning",
    lineClassName: "bg-warning",
  },
  {
    key: "offers",
    label: "Offer",
    dotClassName: "border-success bg-success",
    textClassName: "text-success",
    lineClassName: "bg-success",
  },
];

const TERMINAL_STAGE_META = {
  rejected: {
    label: "Rejected",
    dotClassName: "border-destructive bg-destructive",
    textClassName: "text-destructive",
    lineClassName: "bg-destructive/50",
  },
  closed: {
    label: "Closed",
    dotClassName: "border-muted-foreground/60 bg-muted-foreground/60",
    textClassName: "text-muted-foreground",
    lineClassName: "bg-muted-foreground/25",
  },
};

const MOCK_THREADS = [
  {
    id: "stripe-thread",
    category: "applied",
    subject: "We received your application",
    from: "Stripe Careers <jobs@stripe.com>",
    companyName: "Stripe",
    position: "Senior Frontend Engineer",
    preview: "Application received and queued for review by the UI platform team.",
    ageDays: 0,
    listDateLabel: "Today",
    headerDateLabel: "Thu, Apr 23, 2026, 10:42 AM",
    unreadCount: 1,
    isClosed: false,
    journeyStages: [
      {
        id: "stripe-stage-applied",
        category: "applied",
        subject: "We received your application",
        dateLabel: "Apr 23",
        description: "Application email received",
      },
    ],
    messages: [
      {
        id: "stripe-msg-1",
        from: "Stripe Careers <jobs@stripe.com>",
        subject: "We received your application",
        dateLabel: "Thu, Apr 23, 2026, 10:42 AM",
        body:
          "Thanks for applying to Stripe. Our recruiting team will review your background and follow up if there is a fit.",
      },
      {
        id: "stripe-msg-2",
        from: "Applendium Demo",
        subject: "Stage detected: Applied",
        dateLabel: "Thu, Apr 23, 2026, 10:43 AM",
        body:
          "This demo thread is tracked as Applied because the confirmation email matches the application classifier.",
      },
    ],
  },
  {
    id: "vercel-thread",
    category: "applied",
    subject: "Thanks for applying to Vercel",
    from: "Vercel Talent <talent@vercel.com>",
    companyName: "Vercel",
    position: "Developer Advocate",
    preview: "Confirmation email landed with the role packet and recruiter alias.",
    ageDays: 1,
    listDateLabel: "Yesterday",
    headerDateLabel: "Wed, Apr 22, 2026, 4:12 PM",
    unreadCount: 0,
    isClosed: false,
    journeyStages: [
      {
        id: "vercel-stage-applied",
        category: "applied",
        subject: "Thanks for applying to Vercel",
        dateLabel: "Apr 22",
        description: "Application email received",
      },
    ],
    messages: [
      {
        id: "vercel-msg-1",
        from: "Vercel Talent <talent@vercel.com>",
        subject: "Thanks for applying to Vercel",
        dateLabel: "Wed, Apr 22, 2026, 4:12 PM",
        body:
          "We have your application for Developer Advocate and will be in touch if the team wants to proceed.",
      },
      {
        id: "vercel-msg-2",
        from: "Vercel Talent <talent@vercel.com>",
        subject: "Your submission details",
        dateLabel: "Wed, Apr 22, 2026, 4:13 PM",
        body:
          "This email confirms the portfolio links and location preferences included with your submission.",
      },
    ],
  },
  {
    id: "notion-thread",
    category: "applied",
    subject: "Application submitted",
    from: "Notion Recruiting <jobs@notion.so>",
    companyName: "Notion",
    position: "Product Engineer, Web",
    preview: "Initial confirmation detected from the hiring platform.",
    ageDays: 3,
    listDateLabel: "3 days ago",
    headerDateLabel: "Mon, Apr 20, 2026, 9:08 AM",
    unreadCount: 0,
    isClosed: false,
    journeyStages: [
      {
        id: "notion-stage-applied",
        category: "applied",
        subject: "Application submitted",
        dateLabel: "Apr 20",
        description: "Application email received",
      },
    ],
    messages: [
      {
        id: "notion-msg-1",
        from: "Notion Recruiting <jobs@notion.so>",
        subject: "Application submitted",
        dateLabel: "Mon, Apr 20, 2026, 9:08 AM",
        body:
          "Thanks for your interest in Product Engineer, Web. We will review your application shortly.",
      },
      {
        id: "notion-msg-2",
        from: "Applendium Demo",
        subject: "Stage detected: Applied",
        dateLabel: "Mon, Apr 20, 2026, 9:09 AM",
        body:
          "The thread is now tracked under Applied and linked to the role and company name extracted from the email.",
      },
    ],
  },
  {
    id: "linear-thread",
    category: "interviewed",
    subject: "Tech screen confirmed",
    from: "Linear Recruiting <team@linear.app>",
    companyName: "Linear",
    position: "Product Engineer",
    preview: "Recruiter confirmed the tech screen and shared the interviewer details.",
    ageDays: 0,
    listDateLabel: "Today",
    headerDateLabel: "Thu, Apr 23, 2026, 7:26 AM",
    unreadCount: 1,
    isClosed: false,
    journeyStages: [
      {
        id: "linear-stage-applied",
        category: "applied",
        subject: "We received your application",
        dateLabel: "Apr 17",
        description: "Application email received",
      },
      {
        id: "linear-stage-interview",
        category: "interviewed",
        subject: "Tech screen confirmed",
        dateLabel: "Apr 23",
        description: "Interview email received",
      },
    ],
    messages: [
      {
        id: "linear-msg-1",
        from: "Linear Recruiting <team@linear.app>",
        subject: "Tech screen confirmed",
        dateLabel: "Thu, Apr 23, 2026, 7:26 AM",
        body:
          "Looking forward to meeting on Friday at 3:00 PM ET. Here is the interview format and Zoom link.",
      },
      {
        id: "linear-msg-2",
        from: "Linear Recruiting <team@linear.app>",
        subject: "Meet your interviewer",
        dateLabel: "Thu, Apr 23, 2026, 7:28 AM",
        body:
          "You will speak with a product engineer from the core workflow team.",
      },
      {
        id: "linear-msg-3",
        from: "Calendar <calendar@google.com>",
        subject: "Event invitation: Linear tech screen",
        dateLabel: "Thu, Apr 23, 2026, 7:30 AM",
        body:
          "Friday, 3:00 PM to 3:45 PM ET. Video meeting details attached.",
      },
    ],
  },
  {
    id: "figma-thread",
    category: "interviewed",
    subject: "Next step: system design interview",
    from: "Figma Talent <talent@figma.com>",
    companyName: "Figma",
    position: "System Design Round",
    preview: "The hiring team shared the design round agenda and prep notes.",
    ageDays: 4,
    listDateLabel: "4 days ago",
    headerDateLabel: "Sun, Apr 19, 2026, 1:20 PM",
    unreadCount: 0,
    isClosed: false,
    journeyStages: [
      {
        id: "figma-stage-applied",
        category: "applied",
        subject: "Application received",
        dateLabel: "Apr 12",
        description: "Application email received",
      },
      {
        id: "figma-stage-interview",
        category: "interviewed",
        subject: "Next step: system design interview",
        dateLabel: "Apr 19",
        description: "Interview email received",
      },
    ],
    messages: [
      {
        id: "figma-msg-1",
        from: "Figma Talent <talent@figma.com>",
        subject: "Next step: system design interview",
        dateLabel: "Sun, Apr 19, 2026, 1:20 PM",
        body:
          "The team would like to move forward with a 60-minute system design interview. Attached are the prep notes.",
      },
      {
        id: "figma-msg-2",
        from: "Calendar <calendar@google.com>",
        subject: "Event invitation: Figma system design",
        dateLabel: "Sun, Apr 19, 2026, 1:21 PM",
        body:
          "Tuesday at 11:00 AM PT with two members of the product engineering team.",
      },
    ],
  },
  {
    id: "supabase-thread",
    category: "offers",
    subject: "Verbal offer and next steps",
    from: "Supabase Recruiting <recruiting@supabase.com>",
    companyName: "Supabase",
    position: "Senior Engineer",
    preview: "Offer package arrived with compensation notes and timing details.",
    ageDays: 1,
    listDateLabel: "Yesterday",
    headerDateLabel: "Wed, Apr 22, 2026, 9:15 AM",
    unreadCount: 1,
    isClosed: false,
    journeyStages: [
      {
        id: "supabase-stage-applied",
        category: "applied",
        subject: "Application received",
        dateLabel: "Apr 8",
        description: "Application email received",
      },
      {
        id: "supabase-stage-interview",
        category: "interviewed",
        subject: "Final interview confirmed",
        dateLabel: "Apr 16",
        description: "Interview email received",
      },
      {
        id: "supabase-stage-offer",
        category: "offers",
        subject: "Verbal offer and next steps",
        dateLabel: "Apr 22",
        description: "Offer email received",
      },
    ],
    messages: [
      {
        id: "supabase-msg-1",
        from: "Supabase Recruiting <recruiting@supabase.com>",
        subject: "Verbal offer and next steps",
        dateLabel: "Wed, Apr 22, 2026, 9:15 AM",
        body:
          "We are excited to extend a verbal offer for Senior Engineer. The compensation packet is attached for review.",
      },
      {
        id: "supabase-msg-2",
        from: "Supabase Recruiting <recruiting@supabase.com>",
        subject: "Offer details attached",
        dateLabel: "Wed, Apr 22, 2026, 9:18 AM",
        body:
          "Please review the salary, equity, and benefits summary and let us know if you would like to discuss.",
      },
    ],
  },
  {
    id: "airbnb-thread",
    category: "rejected",
    subject: "Update on your application",
    from: "Airbnb Recruiting <recruiting@airbnb.com>",
    companyName: "Airbnb",
    position: "Frontend Engineer",
    preview: "The team closed the loop and marked the application as not moving forward.",
    ageDays: 5,
    listDateLabel: "5 days ago",
    headerDateLabel: "Sat, Apr 18, 2026, 8:07 AM",
    unreadCount: 0,
    isClosed: false,
    journeyStages: [
      {
        id: "airbnb-stage-applied",
        category: "applied",
        subject: "Application received",
        dateLabel: "Apr 10",
        description: "Application email received",
      },
      {
        id: "airbnb-stage-rejected",
        category: "rejected",
        subject: "Update on your application",
        dateLabel: "Apr 18",
        description: "Rejection email received",
      },
    ],
    messages: [
      {
        id: "airbnb-msg-1",
        from: "Airbnb Recruiting <recruiting@airbnb.com>",
        subject: "Update on your application",
        dateLabel: "Sat, Apr 18, 2026, 8:07 AM",
        body:
          "Thanks again for your interest. We will not be moving forward with your application at this time.",
      },
    ],
  },
  {
    id: "datadog-thread",
    category: "rejected",
    subject: "Your application status",
    from: "Datadog Talent <talent@datadoghq.com>",
    companyName: "Datadog",
    position: "Frontend Platform Engineer",
    preview: "Recruiting sent a polite close-out after the review round.",
    ageDays: 8,
    listDateLabel: "Apr 15",
    headerDateLabel: "Wed, Apr 15, 2026, 3:51 PM",
    unreadCount: 0,
    isClosed: false,
    journeyStages: [
      {
        id: "datadog-stage-applied",
        category: "applied",
        subject: "Application received",
        dateLabel: "Apr 3",
        description: "Application email received",
      },
      {
        id: "datadog-stage-rejected",
        category: "rejected",
        subject: "Your application status",
        dateLabel: "Apr 15",
        description: "Rejection email received",
      },
    ],
    messages: [
      {
        id: "datadog-msg-1",
        from: "Datadog Talent <talent@datadoghq.com>",
        subject: "Your application status",
        dateLabel: "Wed, Apr 15, 2026, 3:51 PM",
        body:
          "We appreciate your interest, but we have decided to move forward with other candidates for this role.",
      },
      {
        id: "datadog-msg-2",
        from: "Datadog Talent <talent@datadoghq.com>",
        subject: "Stay in touch",
        dateLabel: "Wed, Apr 15, 2026, 3:52 PM",
        body:
          "We hope you will keep an eye on future roles that may align well with your experience.",
      },
    ],
  },
];

const REFRESH_LABELS = [
  "Synced just now",
  "2 new thread updates pulled from Gmail",
  "Interview signals refreshed from mock inbox data",
];

function getDisplayStatus(thread) {
  if (thread.isClosed) {
    return "closed";
  }

  return thread.category;
}

function getCountByCategory(threads) {
  return threads.reduce(
    (counts, thread) => {
      counts[thread.category] += 1;
      return counts;
    },
    { applied: 0, interviewed: 0, offers: 0, rejected: 0 }
  );
}

function matchesSearch(thread, query) {
  if (!query) {
    return true;
  }

  const haystack = [
    thread.subject,
    thread.from,
    thread.companyName,
    thread.position,
    thread.preview,
    ...thread.messages.flatMap((message) => [message.subject, message.from, message.body]),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function matchesDateRange(thread, dateRange) {
  if (dateRange === "all") {
    return true;
  }

  if (dateRange === "7d") {
    return thread.ageDays <= 7;
  }

  if (dateRange === "30d") {
    return thread.ageDays <= 30;
  }

  return thread.ageDays <= 90;
}

function getFooterSummary(filterId, count) {
  if (filterId === "applied") {
    return `${count} ${count === 1 ? "application in review" : "applications in review"}`;
  }

  if (filterId === "interviewed") {
    return `${count} ${count === 1 ? "interview scheduled" : "interviews scheduled"}`;
  }

  if (filterId === "offers") {
    return `${count} ${count === 1 ? "offer received" : "offers received"}`;
  }

  if (filterId === "rejected") {
    return `${count} ${count === 1 ? "rejection received" : "rejections received"}`;
  }

  return `${count} ${count === 1 ? "tracked application" : "tracked applications"}`;
}

function StatusBadge({ statusKey }) {
  const statusClassName = {
    applied: "status-badge status-applied",
    interviewed: "status-badge status-interviewed",
    offers: "status-badge status-offers",
    rejected: "status-badge status-rejected",
    closed: "status-badge status-closed",
  }[statusKey] || "status-badge status-applied";

  return (
    <span className={statusClassName}>
      {STATUS_LABELS[statusKey] || "Applied"}
    </span>
  );
}

function LifecycleStepper({ thread }) {
  const displayStatus = getDisplayStatus(thread);
  const observedStages = new Set(thread.journeyStages.map((stage) => stage.category));
  const terminalMeta = displayStatus === "rejected" || displayStatus === "closed"
    ? TERMINAL_STAGE_META[displayStatus]
    : null;
  const lastReachedBaseIndex = DISPLAY_STAGES.reduce((index, stage, stageIndex) => {
    if (observedStages.has(stage.key)) {
      return stageIndex;
    }

    return index;
  }, -1);

  return (
    <div className="mt-2 flex items-center gap-0.5 overflow-hidden">
      {DISPLAY_STAGES.map((stage, index) => {
        const isObserved = observedStages.has(stage.key);
        const isCurrent = displayStatus === stage.key;
        const nextStage = DISPLAY_STAGES[index + 1];
        const connectorActive = isObserved && nextStage && observedStages.has(nextStage.key);

        return (
          <React.Fragment key={stage.key}>
            {index > 0 ? (
              <div
                className={`h-0.5 w-4 shrink-0 rounded-full ${connectorActive ? stage.lineClassName : "bg-muted-foreground/20"}`}
              />
            ) : null}
            <div className="flex min-w-0 flex-col items-center gap-0.5">
              <span
                className={`h-2.5 w-2.5 rounded-full border-2 transition-colors ${isObserved ? stage.dotClassName : "border-muted-foreground/30 bg-transparent"} ${isCurrent ? "ring-2 ring-background" : ""}`}
              />
              <span
                className={`text-[8px] leading-none ${isObserved ? stage.textClassName : "text-muted-foreground/50"} ${isCurrent ? "font-semibold" : ""}`}
              >
                {stage.label}
              </span>
            </div>
          </React.Fragment>
        );
      })}

      {terminalMeta ? (
        <>
          <div
            className={`h-0.5 w-4 shrink-0 rounded-full ${lastReachedBaseIndex >= 0 ? terminalMeta.lineClassName : "bg-muted-foreground/20"}`}
          />
          <div className="flex min-w-0 flex-col items-center gap-0.5">
            <span className={`h-2.5 w-2.5 rounded-full border-2 ring-2 ring-background ${terminalMeta.dotClassName}`} />
            <span className={`text-[8px] leading-none font-semibold ${terminalMeta.textClassName}`}>
              {terminalMeta.label}
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}

function ListSearchBar({ value, onChange, placeholder }) {
  return (
    <div className="mt-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-10 text-sm text-foreground shadow-sm outline-none transition focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ThreadRow({ thread, onSelect }) {
  const displayStatus = getDisplayStatus(thread);
  const isVisuallyClosed = displayStatus === "closed";

  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`landing-demo-thread-${thread.id}`}
      className={`w-full px-3 py-3 text-left transition-colors hover:bg-muted/60 ${isVisuallyClosed ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div
            className={`popup-line-clamp-1 text-sm ${isVisuallyClosed ? "font-medium text-muted-foreground line-through" : thread.unreadCount ? "font-semibold text-foreground" : "font-medium text-foreground/90"}`}
          >
            {thread.subject}
          </div>
          <div className="popup-line-clamp-1 mt-1 text-[11px] text-muted-foreground">
            {thread.from}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {thread.unreadCount ? <span className="h-2 w-2 rounded-full bg-accent" /> : null}
          <span className="text-[10px] text-muted-foreground">{thread.listDateLabel}</span>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 overflow-hidden">
        <StatusBadge statusKey={displayStatus} />
        <span className="max-w-[96px] truncate text-[10px] text-muted-foreground">
          {thread.companyName}
        </span>
        <span className="text-[10px] text-muted-foreground">|</span>
        <span className="truncate text-[10px] text-muted-foreground">{thread.position}</span>
      </div>

      <LifecycleStepper thread={thread} />
    </button>
  );
}

function InlineButton({ children, variant = "outline", className = "", ...props }) {
  const variantClasses = {
    outline: "border border-border bg-card text-foreground hover:bg-muted",
    danger: "border border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/15",
  };

  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function PreviewPane({ thread, onBack, onCloseApplication, onReopenApplication, onDemoAction }) {
  const [activeMessageIndex, setActiveMessageIndex] = useState(0);
  const displayStatus = getDisplayStatus(thread);

  useEffect(() => {
    setActiveMessageIndex(0);
  }, [thread.id]);

  return (
    <div data-testid="landing-demo-preview" className="space-y-4 px-4 py-4">
      <div>
        <h2
          className={`text-[28px] font-semibold leading-tight ${displayStatus === "closed" ? "text-muted-foreground line-through" : "text-foreground"}`}
        >
          {thread.subject}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{thread.from}</p>
        <div className="mt-3 flex items-center gap-2">
          <StatusBadge statusKey={displayStatus} />
          <span className="text-[11px] text-muted-foreground">
            {[thread.companyName, thread.position].filter(Boolean).join(" | ")}
          </span>
        </div>
      </div>

      {thread.messages.length > 1 ? (
        <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] text-muted-foreground">
              {thread.messages.length} messages in thread
            </div>
            <div className="flex items-center gap-2">
              <InlineButton
                className="px-2 py-1 text-[11px]"
                onClick={() => setActiveMessageIndex((current) => Math.max(0, current - 1))}
              >
                Prev
              </InlineButton>
              <InlineButton
                className="px-2 py-1 text-[11px]"
                onClick={() => setActiveMessageIndex((current) => Math.min(thread.messages.length - 1, current + 1))}
              >
                Next
              </InlineButton>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Building2 className="h-4 w-4" />
              Company
            </div>
            <div className="text-sm text-foreground">{thread.companyName}</div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Briefcase className="h-4 w-4" />
              Position
            </div>
            <div className="text-sm text-foreground">{thread.position}</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <TrendingUp className="h-4 w-4 text-accent" />
            Application Journey
          </h3>
          <span className="text-[10px] text-accent">
            {thread.journeyStages.length} stage{thread.journeyStages.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="mt-3 space-y-3">
          {thread.journeyStages.map((stage) => (
            <div key={stage.id} className="flex items-start gap-3">
              <div className="mt-1 h-2.5 w-2.5 rounded-full bg-accent" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <StatusBadge statusKey={stage.category} />
                    <p className="mt-1 text-[11px] text-muted-foreground">{stage.description}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{stage.dateLabel}</span>
                </div>
                <p className="mt-1 break-words text-[11px] text-foreground/80">{stage.subject}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {displayStatus === "closed" ? (
          <InlineButton onClick={onReopenApplication}>
            <TrendingUp className="h-3.5 w-3.5" />
            Reopen
          </InlineButton>
        ) : (
          <InlineButton onClick={onCloseApplication}>
            <X className="h-3.5 w-3.5" />
            Close
          </InlineButton>
        )}

        <InlineButton onClick={() => onDemoAction("Misclassification modal is disabled in the landing demo.")}>
          <Flag className="h-3.5 w-3.5" />
          Misclassify
        </InlineButton>

        <InlineButton onClick={() => onDemoAction("Would open the Gmail thread in the real extension.")}>
          <ExternalLink className="h-3.5 w-3.5" />
          Gmail
        </InlineButton>

        <InlineButton onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </InlineButton>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>{thread.messages.length} message{thread.messages.length === 1 ? "" : "s"}</span>
          </div>
          <span>{thread.headerDateLabel}</span>
        </div>

        <div className="space-y-4">
          {thread.messages.map((message, index) => (
            <div
              key={message.id}
              className={`space-y-2 rounded-xl p-2 transition-colors ${index === activeMessageIndex ? "bg-muted/40" : ""}`}
            >
              {index > 0 ? (
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <div className="h-px flex-1 bg-border" />
                  Older message
                  <div className="h-px flex-1 bg-border" />
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                <span className="truncate">{message.from}</span>
                <span className="shrink-0">{message.dateLabel}</span>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 text-sm text-foreground shadow-sm">
                <div className="text-xs font-semibold text-foreground">{message.subject}</div>
                <p className="mt-3 whitespace-pre-wrap leading-6 text-foreground/90">{message.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoggedOutView({ isLoginPending, onLogin }) {
  return (
    <div data-testid="extension-popup-root" className="flex min-h-full items-center justify-center p-4">
      <div className="w-full">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/15">
            <img src="/logo-transparent.png" alt="" className="h-10 w-10" />
          </div>
          <h1 className="text-2xl font-bold lowercase text-foreground">applendium</h1>
          <p className="mt-2 text-sm text-muted-foreground">Track your job search from your inbox.</p>
        </div>

        <div className="space-y-6 rounded-3xl border border-border bg-card p-6 shadow-[0_16px_40px_rgba(17,24,39,0.08)]">
          <div className="space-y-1 text-center">
            <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
            <p className="text-muted-foreground">
              {isLoginPending ? "Completing Google sign-in..." : "Sign in to your account to continue"}
            </p>
          </div>

          <button
            type="button"
            onClick={onLogin}
            disabled={isLoginPending}
            className={`flex w-full items-center justify-center space-x-2 rounded-xl border px-4 py-3 font-semibold shadow-sm transition-colors duration-200 ${isLoginPending ? "cursor-not-allowed border-border bg-muted text-muted-foreground" : "border-border bg-card text-foreground hover:bg-muted"}`}
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <span>{isLoginPending ? "Signing in..." : "Sign in with Google"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LandingExtensionDemo() {
  const [threads, setThreads] = useState(MOCK_THREADS);
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [isLoginPending, setIsLoginPending] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [allApplicationsFilter, setAllApplicationsFilter] = useState("all");
  const [listSearchQuery, setListSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [isSyncActive, setIsSyncActive] = useState(false);
  const [syncStatusLabel, setSyncStatusLabel] = useState("Synced 2m ago");
  const [demoNotice, setDemoNotice] = useState("");

  const stats = useMemo(() => getCountByCategory(threads), [threads]);
  const normalizedSearchQuery = useMemo(
    () => listSearchQuery.trim().toLowerCase(),
    [listSearchQuery]
  );
  const filteredThreads = useMemo(
    () =>
      threads.filter((thread) => {
        if (allApplicationsFilter !== "all" && thread.category !== allApplicationsFilter) {
          return false;
        }

        if (!matchesDateRange(thread, dateRange)) {
          return false;
        }

        return matchesSearch(thread, normalizedSearchQuery);
      }),
    [allApplicationsFilter, dateRange, normalizedSearchQuery, threads]
  );
  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || null,
    [selectedThreadId, threads]
  );
  const footerSummary = useMemo(
    () => getFooterSummary(allApplicationsFilter, filteredThreads.length),
    [allApplicationsFilter, filteredThreads.length]
  );

  useEffect(() => {
    if (!demoNotice) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setDemoNotice("");
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, [demoNotice]);

  function handleRefresh() {
    if (isSyncActive) {
      return;
    }

    setIsSyncActive(true);
    setSyncStatusLabel("Refreshing Gmail data...");

    window.setTimeout(() => {
      setIsSyncActive(false);
      setSyncStatusLabel(
        REFRESH_LABELS[(filteredThreads.length + threads.length) % REFRESH_LABELS.length]
      );
      setDemoNotice("Mock sync completed.");
    }, 900);
  }

  function handleSignOut() {
    setIsLoggedIn(false);
    setSelectedCategory("all");
    setSelectedThreadId("");
    setDemoNotice("");
  }

  function handleLogin() {
    if (isLoginPending) {
      return;
    }

    setIsLoginPending(true);

    window.setTimeout(() => {
      setIsLoginPending(false);
      setIsLoggedIn(true);
      setSyncStatusLabel("Synced just now");
      setDemoNotice("Signed back into the demo popup.");
    }, 900);
  }

  function handleOpenThread(threadId) {
    setSelectedThreadId(threadId);
    setSelectedCategory("emailPreview");
  }

  function handleBackToList() {
    setSelectedCategory("all");
  }

  function handleCloseApplication() {
    if (!selectedThreadId) {
      return;
    }

    setThreads((currentThreads) =>
      currentThreads.map((thread) =>
        thread.id === selectedThreadId ? { ...thread, isClosed: true } : thread
      )
    );
    setDemoNotice("Application marked closed in the demo.");
  }

  function handleReopenApplication() {
    if (!selectedThreadId) {
      return;
    }

    setThreads((currentThreads) =>
      currentThreads.map((thread) =>
        thread.id === selectedThreadId ? { ...thread, isClosed: false } : thread
      )
    );
    setDemoNotice("Application reopened in the demo.");
  }

  if (!isLoggedIn) {
    return (
      <div className="relative mx-auto max-w-[560px]" data-testid="landing-extension-demo">
        <div
          className="animate-float absolute -left-4 -top-4 z-20 rounded-full bg-[#10B981] px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-[4px_4px_0_0_rgba(17,17,17,1)]"
          style={{ "--rot": "-4deg" }}
        >
          <span className="inline-flex items-center gap-1">
            <Zap className="h-3 w-3" strokeWidth={2.5} />
            Live demo
          </span>
        </div>

        <div
          className="animate-float absolute -bottom-6 -right-3 z-20 rounded-full border-2 border-[#111111] bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-black shadow-[4px_4px_0_0_rgba(17,17,17,1)]"
          style={{ "--rot": "3deg", animationDelay: "0.6s" }}
        >
          Read-only Gmail
        </div>

        <div className="overflow-hidden rounded-[28px] border border-gray-200 bg-white p-3 shadow-[0_30px_80px_-20px_rgba(17,17,17,0.25)]">
          <div className="rounded-[20px] border border-gray-200 bg-[#F7F7F5] p-3">
            <LoggedOutView isLoginPending={isLoginPending} onLogin={handleLogin} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-[560px]" data-testid="landing-extension-demo">
      <div
        className="animate-float absolute -left-4 -top-4 z-20 rounded-full bg-[#10B981] px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-[4px_4px_0_0_rgba(17,17,17,1)]"
        style={{ "--rot": "-4deg" }}
      >
        <span className="inline-flex items-center gap-1">
          <Zap className="h-3 w-3" strokeWidth={2.5} />
          Live demo
        </span>
      </div>

      <div
        className="animate-float absolute -bottom-6 -right-3 z-20 rounded-full border-2 border-[#111111] bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-black shadow-[4px_4px_0_0_rgba(17,17,17,1)]"
        style={{ "--rot": "3deg", animationDelay: "0.6s" }}
      >
        Read-only Gmail
      </div>

      <div className="overflow-hidden rounded-[28px] border border-gray-200 bg-white p-3 shadow-[0_30px_80px_-20px_rgba(17,17,17,0.25)]">
        <div
          data-testid="extension-popup-root"
          className="relative mx-auto flex h-[600px] max-h-[600px] w-full max-w-[400px] flex-col overflow-hidden rounded-[18px] border border-border bg-background text-foreground shadow-[0_18px_40px_rgba(17,24,39,0.14)]"
        >
          <div className="flex items-center justify-between bg-primary px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              {selectedCategory === "emailPreview" ? (
                <button
                  type="button"
                  onClick={handleBackToList}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-primary-foreground/80 transition hover:bg-primary-foreground/10 hover:text-primary-foreground"
                  aria-label="Back to all applications"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              ) : null}
              <img src="/logo-transparent.png" alt="" className="h-5 w-5 shrink-0" />
              <span className="truncate text-sm font-semibold lowercase text-primary-foreground">applendium</span>
              <span className="rounded bg-primary-foreground/10 px-1.5 py-0.5 text-[10px] text-primary-foreground/75">
                Free
              </span>
              <span
                className="rounded bg-primary-foreground/10 px-1.5 py-0.5 text-[10px] text-primary-foreground/75"
                title="47 of 100 tracked applications used on the free plan."
              >
                47/100
              </span>
            </div>
            <div className="text-[10px] text-primary-foreground/60">
              {selectedCategory === "emailPreview" ? "" : "v1.0.0"}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto popup-scrollbar">
            {selectedCategory === "emailPreview" && selectedThread ? (
              <PreviewPane
                thread={selectedThread}
                onBack={handleBackToList}
                onCloseApplication={handleCloseApplication}
                onReopenApplication={handleReopenApplication}
                onDemoAction={setDemoNotice}
              />
            ) : (
              <div className="flex h-full flex-col">
                <div className="space-y-3 px-3 py-3">
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { key: "applied", label: "Applied", value: stats.applied, cardClass: "bg-secondary", textClass: "text-primary" },
                      { key: "interviewed", label: "Interviews", value: stats.interviewed, cardClass: "bg-warning/15", textClass: "text-warning" },
                      { key: "offers", label: "Offers", value: stats.offers, cardClass: "bg-success/10", textClass: "text-success" },
                      { key: "rejected", label: "Rejected", value: stats.rejected, cardClass: "bg-destructive/10", textClass: "text-destructive" },
                    ].map((stat) => (
                      <div key={stat.key} className={`${stat.cardClass} rounded-xl px-2 py-2 text-center`}>
                        <div className={`text-xl font-bold leading-none tracking-[-0.02em] ${stat.textClass}`}>{stat.value}</div>
                        <div className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <ListSearchBar
                      value={listSearchQuery}
                      onChange={setListSearchQuery}
                      placeholder="Search companies, roles..."
                    />

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowDateFilter((current) => !current)}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors ${dateRange !== "all" ? "border-accent/30 bg-accent/10 text-accent" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                      >
                        <CalendarDays className="h-3 w-3" />
                        {dateRange === "all"
                          ? "Date"
                          : dateRange === "7d"
                            ? "Past 7 days"
                            : dateRange === "30d"
                              ? "Past 30 days"
                              : "Past 90 days"}
                      </button>

                      {showDateFilter ? (
                        <div className="flex gap-1">
                          {DATE_FILTERS.map((option) => (
                            <button
                              key={option.key}
                              type="button"
                              onClick={() => {
                                setDateRange(option.key);
                                setShowDateFilter(false);
                              }}
                              className={`rounded px-2 py-1 text-[10px] font-medium transition-colors ${dateRange === option.key ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex gap-1.5 overflow-x-auto pb-1 popup-scrollbar">
                    {MAIN_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setAllApplicationsFilter(tab.id);
                          setShowDateFilter(false);
                        }}
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${allApplicationsFilter === tab.id ? tab.activeClassName : "border-border bg-card text-muted-foreground hover:bg-muted"}`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card/80 px-3 py-2 text-[11px] text-muted-foreground shadow-sm">
                    <span>{syncStatusLabel}</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleRefresh}
                        className="inline-flex items-center gap-1 transition hover:text-foreground"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isSyncActive ? "animate-spin" : ""}`} />
                        Refresh
                      </button>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="inline-flex items-center gap-1 transition hover:text-foreground"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Sign out
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-card popup-scrollbar">
                  {filteredThreads.length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No emails found for this filter.
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {filteredThreads.map((thread) => (
                        <ThreadRow
                          key={thread.id}
                          thread={thread}
                          onSelect={() => handleOpenThread(thread.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {selectedCategory !== "emailPreview" ? (
            <div className="flex items-center justify-between border-t border-border bg-muted/40 px-3 py-2 text-[10px]">
              <span className="text-muted-foreground">{footerSummary}</span>
              <button
                type="button"
                onClick={() => setDemoNotice("Premium opens from the real extension or web upgrade page.")}
                className="font-medium text-accent transition hover:text-accent/80"
              >
                Premium -&gt;
              </button>
            </div>
          ) : null}

          {demoNotice ? (
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-full bg-[#111111] px-3 py-1.5 text-[10px] font-medium text-white shadow-[0_12px_28px_rgba(17,24,39,0.25)]">
              {demoNotice}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
