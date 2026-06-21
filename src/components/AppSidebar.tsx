import { Crown } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/AuthContext.jsx";

const mainNav = [
  { title: "Dashboard", url: "/dashboard", code: "db" },
  { title: "Apply Gate", url: "/apply-gate", code: "ag" },
  { title: "Next Actions", url: "/fix-suggestions", code: "na" },
  { title: "Outcome Memory", url: "/outcome-memory", code: "om" },
  { title: "Strategy Alerts", url: "/strategy-alerts", code: "sa" },
  { title: "Weekly Summary", url: "/weekly-summary", code: "ws" },
];

function NavCode({ code }: { code: string }) {
  return (
    <span className="nav-code w-[22px] h-[22px] rounded-md grid place-items-center font-mono text-[9px] font-bold tracking-[0.05em] shrink-0 bg-white/[0.06] text-[#7C8AA3] transition-colors">
      {code}
    </span>
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
      <SidebarHeader className="px-4 py-[18px] border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-[26px] h-[26px] rounded-[7px] bg-white/[0.06] ring-1 ring-white/10 grid place-items-center shrink-0">
            <img src="/logo-transparent.png" alt="Applendium" className="w-5 h-5 block" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-[-0.01em] leading-tight text-sidebar-accent-foreground">
              applendium
            </h2>
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[#2FBE8F]">
              {planLoading ? "…" : isPremium ? "Premium" : "Free"}
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2.5 py-3.5">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] font-medium text-sidebar-foreground hover:bg-white/[0.05] hover:text-white transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold [&_.nav-code]:bg-[#0E8C63] [&_.nav-code]:text-white"
                    >
                      <NavCode code={item.code} />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <div className="mt-auto px-2.5 py-3.5 border-t border-sidebar-border space-y-2">
        <NavLink
          to="/settings"
          className="group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] font-medium text-sidebar-foreground hover:bg-white/[0.05] hover:text-white transition-colors"
          activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold [&_.nav-code]:bg-[#0E8C63] [&_.nav-code]:text-white"
        >
          <NavCode code="st" />
          <span>Settings</span>
        </NavLink>

        {!isPremium && !planLoading ? (
          <NavLink
            to="/upgrade"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-[10px] bg-[#0E8C63] text-white text-sm font-semibold hover:bg-[#10B981] transition-colors"
            activeClassName="opacity-90"
          >
            <Crown className="w-4 h-4" />
            Upgrade Plan
          </NavLink>
        ) : null}

        {user ? (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] bg-white/[0.04] border border-white/10">
            <div className="w-7 h-7 rounded-full bg-[#2FBE8F]/15 text-[#5FD9AE] grid place-items-center text-[11px] font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold text-sidebar-accent-foreground truncate">
                {displayName}
              </div>
              {user?.email && user.email !== displayName ? (
                <div className="text-[11px] text-sidebar-muted truncate">{user.email}</div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </Sidebar>
  );
}
