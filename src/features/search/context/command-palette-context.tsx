/**
 * Command Palette Context
 * Provides shared state for command palette across components
 * Requirements: 12.1, 12.4
 */
import * as React from "react";

const DEBOUNCE_DELAY = 300; // ms

export interface CommandPaletteContextValue {
  /** Whether the command palette is open */
  open: boolean;
  /** Set the open state */
  setOpen: (open: boolean) => void;
  /** Toggle the open state */
  toggle: () => void;
  /** Current search query */
  query: string;
  /** Set the search query */
  setQuery: (query: string) => void;
  /** Debounced search query for API calls */
  debouncedQuery: string;
}

const CommandPaletteContext =
  React.createContext<CommandPaletteContextValue | null>(null);

export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");

  // Debounce the search query
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, DEBOUNCE_DELAY);

    return () => clearTimeout(timer);
  }, [query]);

  // Clear query when closing
  React.useEffect(() => {
    if (!open) {
      // Small delay to allow animation to complete
      const timer = setTimeout(() => {
        setQuery("");
        setDebouncedQuery("");
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+K (Windows/Linux) or Cmd+K (Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggle = React.useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const value = React.useMemo(
    () => ({
      open,
      setOpen,
      toggle,
      query,
      setQuery,
      debouncedQuery,
    }),
    [open, toggle, query, debouncedQuery]
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPaletteContext(): CommandPaletteContextValue {
  const context = React.useContext(CommandPaletteContext);
  if (!context) {
    throw new Error(
      "useCommandPaletteContext must be used within a CommandPaletteProvider"
    );
  }
  return context;
}
