/**
 * ActivityFeed component - displays a list of activity log entries
 * Requirements: 10.2
 */
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ActivityItem } from "./activity-item";
import type { ActivityLog } from "../types";

interface ActivityFeedProps {
  activities: ActivityLog[];
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  emptyMessage?: string;
  maxHeight?: string;
}

function ActivitySkeleton() {
  return (
    <div className="flex items-start gap-3 py-3">
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
      </div>
    </div>
  );
}

export function ActivityFeed({
  activities,
  isLoading,
  hasMore,
  onLoadMore,
  isLoadingMore,
  emptyMessage = "No activity yet",
  maxHeight = "400px",
}: ActivityFeedProps) {
  if (isLoading) {
    return (
      <div className="space-y-1 divide-y">
        {[1, 2, 3, 4, 5].map((i) => (
          <ActivitySkeleton key={i} />
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <ScrollArea style={{ maxHeight }} className="pr-4">
      <div className="space-y-1 divide-y">
        {activities.map((activity) => (
          <ActivityItem key={activity.id} activity={activity} />
        ))}
      </div>

      {hasMore && onLoadMore && (
        <div className="pt-4 pb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="w-full"
          >
            {isLoadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </ScrollArea>
  );
}
