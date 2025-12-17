/**
 * Hook for detaching a tag from an entity
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { detachTag } from "../api";
import { useSession } from "@/features/auth/hooks";
import type { DetachTagInput } from "../types";

interface DetachTagParams {
  tagId: string;
  data: DetachTagInput;
}

export function useDetachTag() {
  const queryClient = useQueryClient();
  const { csrfToken } = useSession();

  return useMutation({
    mutationFn: ({ tagId, data }: DetachTagParams) => {
      if (!csrfToken) {
        throw new Error("Not authenticated");
      }
      return detachTag(tagId, data, csrfToken);
    },
    onSuccess: (_, variables) => {
      // Invalidate tags and the entity's tags
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      queryClient.invalidateQueries({
        queryKey: [
          variables.data.taggableType.toLowerCase(),
          variables.data.taggableId,
          "tags",
        ],
      });
      // Also invalidate the entity list to refresh tag display
      queryClient.invalidateQueries({
        queryKey: [variables.data.taggableType.toLowerCase() + "s"],
      });
    },
  });
}
