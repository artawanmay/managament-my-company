import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/layout/sidebar-context";
import { CommandPalette, CommandPaletteProvider } from "@/features/search";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { isCollapsed, isMobile } = useSidebar();

  return (
    <CommandPaletteProvider>
      <div className="min-h-screen bg-background">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content area */}
        <div
          className={cn(
            "flex min-h-screen flex-col transition-all duration-300",
            !isMobile && (isCollapsed ? "md:pl-16" : "md:pl-64")
          )}
        >
          {/* Topbar */}
          <Topbar />

          {/* Page content */}
          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </div>

        {/* Command Palette - Global search with Ctrl+K/Cmd+K */}
        <CommandPalette />
      </div>
    </CommandPaletteProvider>
  );
}
