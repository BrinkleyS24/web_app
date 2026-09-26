import { SidebarProvider } from "@/components/ui/sidebar";
import { AppTopBar } from "@/components/AppTopBar";
import { AppSidebar } from "@/components/AppSidebar";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-h-screen min-w-0">
          <AppTopBar />
          <div className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
