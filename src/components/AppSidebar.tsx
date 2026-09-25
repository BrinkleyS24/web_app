import type { LucideIcon } from "lucide-react";
import {
  CalendarRange,
  Crown,
  FileText,
  LayoutDashboard,
  ListChecks,
  Radar,
  ScanSearch,
  Settings as SettingsIcon,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/AuthContext.jsx";

type NavItem = { title: string; url: string; icon: LucideIcon };

// Two groups, in the order the product works: understand the search and act on it, then the
// tools behind the decisions. Outcome Memory is gone as its own page — its one current finding
// (skill gaps across roles you checked) lives on Strategy Alerts now.
const searchNav: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Next Actions", url: "/next-actions", icon: ListChecks },
  { title: "Strategy Alerts", url: "/strategy-alerts", icon: Radar },
  { title: "Weekly Summary", url: "/weekly-summary", icon: CalendarRange },
];

const toolsNav: NavItem[] = [
  { title: "Apply Gate", url: "/apply-gate", icon: ScanSearch },
  { title: "Résumés", url: "/resumes", icon: FileText },
];

const linkClass =
  "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-sidebar-foreground transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";
const activeLinkClass =
  "bg-sidebar-accent text-sidebar-accent-foreground font-semibold [&_svg]:text-[#5FD9AE]";

function NavGroup({ label, items }: { label: string; items: NavItem[] }) {
  return (
    <SidebarGroup className="px-0 py-1">
      <SidebarGroupLabel className="px-2.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-sidebar-muted">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <NavLink to={item.url} className={linkClass} activeClassName={activeLinkClass}>
                  <item.icon className="h-4 w-4 shrink-0 text-[#7C8AA3] transition-colors group-hover:text-white" aria-hidden />
                  <span>{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function initialsFromUser(name?: string | null, email?: string | null) {
  const source = String(name || "").trim();
  if (source) {
    const parts = source.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase() || "?";
  }
  const emailChar = String(email || "").trim()[0];
  return emailChar ? emailChar.toUpperCase() : "?";
}

export function AppSidebar() {
  const { user, plan, planLoading } = useAuth();
  const isPremium = plan === "premium";
  const displayName = user?.displayName || user?.email || "Signed in";
  const initials = initialsFromUser(user?.displayName, user?.email);

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-[18px]">
        <div className="flex items-center gap-2.5">
          <div className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[7px] bg-white/[0.06] ring-1 ring-white/10">
            <img src="/logo-transparent.png" alt="" className="block h-5 w-5" />
          </div>
          <h2 className="text-[15px] font-bold leading-tight tracking-[-0.01em] text-sidebar-accent-foreground">
            Applendium
          </h2>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2.5 py-3">
        <NavGroup label="Your search" items={searchNav} />
        <NavGroup label="Tools" items={toolsNav} />
      </SidebarContent>

      <div className="mt-auto space-y-2 border-t border-sidebar-border px-2.5 py-3.5">
        <NavLink to="/settings" className={linkClass} activeClassName={activeLinkClass}>
          <SettingsIcon className="h-4 w-4 shrink-0 text-[#7C8AA3] transition-colors group-hover:text-white" aria-hidden />
          <span>Settings</span>
        </NavLink>

        {!isPremium && !planLoading ? (
          <NavLink
            to="/upgrade"
            className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#0E8C63] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#10B981]"
            activeClassName="opacity-90"
          >
            <Crown className="h-4 w-4" />
            Upgrade Plan
          </NavLink>
        ) : null}

        {user ? (
          <div className="flex items-center gap-2.5 rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#2FBE8F]/15 text-[11px] font-bold text-[#5FD9AE]">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-semibold text-sidebar-accent-foreground">{displayName}</div>
              {user?.email && user.email !== displayName ? (
                <div className="truncate text-[11px] text-sidebar-muted">{user.email}</div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </Sidebar>
  );
}
