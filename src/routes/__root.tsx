/// <reference types="vite/client" />
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "@/lib/query-client";
import appCss from "@/styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "MMC - Management My Company",
      },
      {
        name: "description",
        content: "Internal management application for PT. Metta Cipta Lestari",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
});

// Inline script to prevent theme flash on page load
// This runs before React hydrates, applying the correct theme immediately
const themeScript = `
(function() {
  var storageKey = 'mmc-theme';
  var theme = localStorage.getItem(storageKey);
  var root = document.documentElement;
  
  // Add no-transition class to prevent any flash during initial load
  root.classList.add('no-transition');
  
  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'light') {
    root.classList.remove('dark');
  } else {
    // System preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark');
    }
  }
  
  // Remove no-transition after a brief delay
  window.addEventListener('DOMContentLoaded', function() {
    requestAnimationFrame(function() {
      root.classList.remove('no-transition');
    });
  });
})();
`;

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Inline script to apply theme before paint - prevents white flash */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="mmc-theme">
        <TooltipProvider>
          <SidebarProvider>
            <Outlet />
            <Toaster />
          </SidebarProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
