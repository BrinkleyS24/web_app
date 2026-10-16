import { SidebarProvider } from "@/components/ui/sidebar";
import { AppTopBar } from "@/components/AppTopBar";
import { AppSidebar } from "@/components/AppSidebar";
import { ActionWorkspaceBanner } from "@/components/premium/ActionWorkspaceBanner";

/** The one content width every signed-in page uses (designer review, 2026-10-14: there were three). */
export const APP_CONTENT_WIDTH = "max-w-[1120px]";

/**
 * `actionBannerInPage`: the page places <ActionWorkspaceBanner /> itself, below its heading. Interview
 * Prep does (designer review, 2026-10-15: the task card sat above the page H1).
 */
export function DashboardLayout({ children, actionBannerInPage = false }: { children: React.ReactNode; actionBannerInPage?: boolean }) {
  return (
    <SidebarProvider>
      {/* Keyboard users skip the sidebar and top bar on every page (2026-10-14). */}
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className="min-h-screen flex w-full bg-muted">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-h-screen min-w-0">
          <AppTopBar />
          <div
            id="main-content"
            tabIndex={-1}
            className={`flex-1 px-4 py-6 sm:p-6 md:p-8 ${APP_CONTENT_WIDTH} w-full mx-auto animate-fade-in outline-none`}
          >
            {actionBannerInPage ? null : <ActionWorkspaceBanner />}
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
