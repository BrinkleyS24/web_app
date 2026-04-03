import { AdminSidebar } from "@/components/AdminSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full overflow-x-hidden">
        <AdminSidebar />
        <main className="flex-1 min-w-0 flex flex-col min-h-screen overflow-x-hidden">
          <header className="h-14 flex items-center border-b border-border px-4 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
            <SidebarTrigger className="mr-4" />
          </header>
          <div className="flex-1 w-full max-w-5xl mx-auto animate-fade-in px-4 py-6 md:px-6 md:py-8">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
