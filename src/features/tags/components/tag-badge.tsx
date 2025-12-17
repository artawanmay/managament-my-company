/**
 * TagBadge component
 * Displays a tag with its color
 */
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tag } from "../types";

interface TagBadgeProps {
  tag: Tag;
  onRemove?: () => void;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Calculate contrasting text color based on background color
 */
function getContrastColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace("#", "");

  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return black or white based on luminance
  return luminance > 0.5 ? "#000000" : "#FFFFFF";
}

export function TagBadge({
  tag,
  onRemove,
  className,
  size = "md",
}: TagBadgeProps) {
  const textColor = getContrastColor(tag.color);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium transition-colors",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        className
      )}
      style={{
        backgroundColor: tag.color,
        color: textColor,
      }}
    >
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 focus:outline-none focus:ring-1 focus:ring-white/50"
          aria-label={`Remove ${tag.name} tag`}
        >
          <X className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
        </button>
      )}
    </span>
  );
}
