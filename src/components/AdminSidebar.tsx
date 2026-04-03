import { Bug, Crown, LogOut, ShieldAlert } from "lucide-react";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/AuthContext.jsx";
import { auth } from "@/lib/firebase.js";

export function AdminSidebar() {
  const navigate = useNavigate();
  const { user } = useAuth();

  async function handleSignOut() {
    try {
      if (auth) await signOut(auth);
    } catch (_) {
      // Ignore sign-out failures in local bypass mode.
    } finally {
      navigate("/", { replace: true });
    }
  }

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <ShieldAlert className="w-4 h-4 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-sidebar-accent-foreground">Applendium</h2>
            <p className="text-xs text-sidebar-muted">Admin Dashboard</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-muted mb-2 px-3">
            Admin
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/admin/debug"
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  >
                    <Bug className="w-4 h-4 shrink-0" />
                    <span>Admin Dashboard</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <div className="mt-auto p-4 border-t border-sidebar-border space-y-3">
        <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-widest text-sidebar-muted">Signed In</p>
          <p className="mt-1 text-sm text-sidebar-accent-foreground break-all">{user?.email || "Admin"}</p>
        </div>

        <div className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 text-sm font-medium">
          <Crown className="w-4 h-4" />
          Admin Access
        </div>

        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-sidebar-border bg-sidebar-accent/30 text-sidebar-accent-foreground hover:bg-sidebar-accent"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </Sidebar>
  );
}
