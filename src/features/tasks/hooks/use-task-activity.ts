/**
 * Hook for fetching task activity logs
 */
import { useQuery } from "@tanstack/react-query";

export interface TaskActivityLog {
  id: string;
  actorId: string;
  entityType: string;
  entityId: string;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
  actorAvatarUrl: string | null;
}

async function fetchTaskActivity(
  taskId: string,
  limit = 20
): Promise<{ data: TaskActivityLog[] }> {
  const response = await fetch(`/api/tasks/${taskId}/activity?limit=${limit}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch activity logs");
  }

  return response.json();
}

export function useTaskActivity(taskId: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ["task-activity", taskId, limit],
    queryFn: () => fetchTaskActivity(taskId!, limit),
    enabled: !!taskId,
  });
}
