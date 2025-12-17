"use client";

import * as React from "react";

interface SidebarContextState {
  isOpen: boolean;
  isCollapsed: boolean;
  isMobile: boolean;
  isInitialMount: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = React.createContext<SidebarContextState | undefined>(
  undefined
);

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1200;
const STORAGE_KEY = "sidebar-collapsed";

/**
 * Reads the stored collapse state from localStorage
 * Returns null if localStorage is unavailable or no value is stored
 */
export function getStoredCollapseState(): boolean | null {
  // Check if we're in a browser environment
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== null ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/**
 * Writes the collapse state to localStorage
 * Silently fails if localStorage is unavailable
 */
export function setStoredCollapseState(collapsed: boolean): void {
  // Check if we're in a browser environment
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed));
  } catch {
    // Silently fail if localStorage is not available
  }
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(() => {
    // Initialize from localStorage if available
    const stored = getStoredCollapseState();
    return stored ?? false;
  });
  const [isMobile, setIsMobile] = React.useState(false);
  // Track if initial mount is complete (to disable animations on first render)
  const [isInitialMount, setIsInitialMount] = React.useState(true);
  // Track if user has explicitly set a preference
  const hasUserPreference = React.useRef(getStoredCollapseState() !== null);

  // Track if viewport check has completed
  const viewportChecked = React.useRef(false);

  React.useEffect(() => {
    const checkViewport = () => {
      const width = window.innerWidth;
      setIsMobile(width < MOBILE_BREAKPOINT);

      // Only auto-collapse if user hasn't set a preference
      if (!hasUserPreference.current) {
        if (width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT) {
          setIsCollapsed(true);
        } else if (width >= TABLET_BREAKPOINT) {
          setIsCollapsed(false);
        }
      }

      // Close mobile drawer when resizing to desktop
      if (width >= MOBILE_BREAKPOINT) {
        setIsOpen(false);
      }

      // Mark viewport as checked
      viewportChecked.current = true;
    };

    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

  // Mark initial mount as complete after viewport check and DOM paint
  // Use longer timeout to ensure all initial state changes are complete
  React.useEffect(() => {
    // Wait for viewport check to complete first
    const timer = setTimeout(() => {
      if (viewportChecked.current) {
        setIsInitialMount(false);
      }
    }, 100); // Longer delay to ensure all state is stable
    return () => clearTimeout(timer);
  }, []);

  const setCollapsed = React.useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed);
    setStoredCollapseState(collapsed);
    hasUserPreference.current = true;
  }, []);

  const toggle = React.useCallback(() => {
    if (isMobile) {
      setIsOpen((prev) => !prev);
    } else {
      setCollapsed(!isCollapsed);
    }
  }, [isMobile, isCollapsed, setCollapsed]);

  const open = React.useCallback(() => setIsOpen(true), []);
  const close = React.useCallback(() => setIsOpen(false), []);

  const value = React.useMemo(
    () => ({
      isOpen,
      isCollapsed,
      isMobile,
      isInitialMount,
      toggle,
      open,
      close,
      setCollapsed,
    }),
    [
      isOpen,
      isCollapsed,
      isMobile,
      isInitialMount,
      toggle,
      open,
      close,
      setCollapsed,
    ]
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = React.useContext(SidebarContext);

  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }

  return context;
}
