/**
 * Command Palette Hook
 * Re-exports the context hook for convenience
 * Requirements: 12.1, 12.4
 */
import { useCommandPaletteContext, type CommandPaletteContextValue } from '../context';

export type UseCommandPaletteReturn = CommandPaletteContextValue;

/**
 * Hook for accessing command palette state
 * Must be used within CommandPaletteProvider
 */
export function useCommandPalette(): UseCommandPaletteReturn {
  return useCommandPaletteContext();
}
