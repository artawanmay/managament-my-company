"use client";

import * as React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  UserCog,
  Briefcase,
  FolderKanban,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useSidebar } from "./sidebar-context";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  usePermissions,
  type SidebarPermission,
} from "@/hooks/use-permissions";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermission?: SidebarPermission;
}

// Icon mapping untuk setiap menu
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Dashboard: LayoutDashboard,
  Clients: Users,
  Projects: FolderKanban,
  Tasks: Briefcase,
  Notes: FileText,
  Users: UserCog,
};

const bottomNavItems: NavItem[] = [
  {
    title: "Settings",
    href: "/app/settings",
    icon: Settings,
  },
];

interface NavLinkProps {
  item: NavItem;
  isCollapsed: boolean;
  isActive: boolean;
  onClick?: () => void;
}

function NavLink({ item, isCollapsed, isActive, onClick }: NavLinkProps) {
  const Icon = item.icon;

  const linkContent = (
    <Link
      to={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        isActive ? "bg-primary/10 text-primary" : "text-muted-foreground",
        isCollapsed && "justify-center px-2"
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
      {!isCollapsed && <span>{item.title}</span>}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-4">
          {item.title}
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
}

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const { isCollapsed, setCollapsed, isMobile } = useSidebar();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const { getVisibleSidebarModules, isLoading } = usePermissions();

  // Get visible nav items based on user permissions
  const visibleNavItems: NavItem[] = React.useMemo(() => {
    if (isLoading) return [];

    const modules = getVisibleSidebarModules();
    return modules.map((module) => ({
      title: module.title,
      href: module.href,
      icon: iconMap[module.title] || LayoutDashboard,
      requiredPermission: module.requiredPermission,
    }));
  }, [getVisibleSidebarModules, isLoading]);

  return (
    <div className="flex h-full flex-col">
      {/* Logo/Brand */}
      <div
        className={cn(
          "flex h-16 items-center border-b px-4",
          isCollapsed && !isMobile && "justify-center px-2"
        )}
      >
        {!isCollapsed || isMobile ? (
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-sm font-bold">M</span>
            </div>
            <span className="text-lg font-semibold">MMC</span>
          </Link>
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-sm font-bold">M</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-1">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              isCollapsed={isCollapsed && !isMobile}
              isActive={currentPath.startsWith(item.href)}
              onClick={onNavClick}
            />
          ))}
        </nav>
      </ScrollArea>

      {/* Bottom section */}
      <div className="mt-auto border-t px-3 py-4">
        <nav className="flex flex-col gap-1">
          {bottomNavItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              isCollapsed={isCollapsed && !isMobile}
              isActive={currentPath.startsWith(item.href)}
              onClick={onNavClick}
            />
          ))}
        </nav>

        {/* Collapse toggle (desktop/tablet only) */}
        {!isMobile && (
          <>
            <Separator className="my-4" />
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "w-full justify-start",
                isCollapsed && "justify-center"
              )}
              onClick={() => setCollapsed(!isCollapsed)}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  <span>Collapse</span>
                </>
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function Sidebar() {
  const { isOpen, close, isCollapsed, isMobile, isInitialMount } = useSidebar();

  // Mobile drawer
  if (isMobile) {
    return (
      <>
        {/* Backdrop with glass overlay effect */}
        {isOpen && (
          <div className="fixed inset-0 z-40 glass-overlay" onClick={close} />
        )}

        {/* Drawer with glass styling */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-64 glass-sidebar shadow-lg",
            "transform transition-transform duration-300 ease-in-out",
            isOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-4 z-10"
            onClick={close}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close sidebar</span>
          </Button>

          <SidebarContent onNavClick={close} />
        </aside>
      </>
    );
  }

  // Desktop/Tablet sidebar with glass styling
  // Disable transition on initial mount to prevent animation on page load/refresh
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden glass-sidebar md:block",
        isInitialMount
          ? "no-transition"
          : "transition-all duration-300 ease-in-out",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <SidebarContent />
    </aside>
  );
}
