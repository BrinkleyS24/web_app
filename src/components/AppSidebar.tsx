import {
  LayoutDashboard,
  Shield,
  Wrench,
  Brain,
  Bell,
  FileText,
  Crown,
  Settings,
  CheckCircle2,
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

const mainNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Apply Gate", url: "/apply-gate", icon: Shield },
  { title: "Fix Suggestions", url: "/fix-suggestions", icon: Wrench },
  { title: "Outcome Memory", url: "/outcome-memory", icon: Brain },
  { title: "Strategy Alerts", url: "/strategy-alerts", icon: Bell },
  { title: "Weekly Summary", url: "/weekly-summary", icon: FileText },
];

export function AppSidebar() {
  const { plan, planLoading } = useAuth();
  const isPremium = plan === "premium";

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Crown className="w-4 h-4 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-sidebar-accent-foreground">MorrowFold</h2>
            <p className="text-xs text-sidebar-muted">
              {planLoading ? "…" : isPremium ? "Premium" : "Free"}
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-muted mb-2 px-3">
            Features
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <div className="mt-auto p-4 border-t border-sidebar-border space-y-2">
        {/* Settings link */}
        <NavLink
          to="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span>Settings</span>
        </NavLink>

        {/* Plan button — changes based on subscription status */}
        {isPremium ? (
          <div className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Premium Active
          </div>
        ) : (
          <NavLink
            to="/upgrade"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            activeClassName="opacity-90"
          >
            <Crown className="w-4 h-4" />
            Upgrade Plan
          </NavLink>
        )}
      </div>
    </Sidebar>
  );
}

