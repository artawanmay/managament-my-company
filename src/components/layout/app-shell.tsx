"use client";

import * as React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./theme-provider";
import { SidebarProvider, useSidebar } from "./sidebar-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  topbar?: React.ReactNode;
}

function AppShellContent({ children, sidebar, topbar }: AppShellProps) {
  const { isCollapsed, isMobile, isInitialMount } = useSidebar();

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      {sidebar}

      {/* Main content area */}
      {/* Disable transition on initial mount to prevent animation on page load/refresh */}
      <div
        className={cn(
          "flex min-h-screen flex-col",
          isInitialMount ? "no-transition" : "transition-all duration-300",
          !isMobile && sidebar && (isCollapsed ? "md:pl-16" : "md:pl-64")
        )}
      >
        {/* Topbar */}
        {topbar}

        {/* Page content - disable transition animation on initial mount */}
        <main
          className={cn(
            "flex-1 p-4 md:p-6",
            !isInitialMount && "page-transition-enter"
          )}
        >
          {children}
        </main>
      </div>

      {/* Toast notifications */}
      <Toaster />
    </div>
  );
}

export function AppShell({ children, sidebar, topbar }: AppShellProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="mmc-theme">
        <TooltipProvider>
          <SidebarProvider>
            <AppShellContent sidebar={sidebar} topbar={topbar}>
              {children}
            </AppShellContent>
          </SidebarProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

// Export providers separately for flexibility
export { ThemeProvider } from "./theme-provider";
export { SidebarProvider, useSidebar } from "./sidebar-context";
