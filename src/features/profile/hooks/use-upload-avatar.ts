/**
 * useUploadAvatar Hook - Upload avatar image
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

async function uploadAvatar(file: File) {
  const csrfToken = sessionStorage.getItem("csrf_token");
  const formData = new FormData();
  formData.append("avatar", file);

  const response = await fetch("/api/profile/avatar", {
    method: "POST",
    headers: {
      ...(csrfToken && { "X-CSRF-Token": csrfToken }),
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to upload avatar");
  }

  return response.json();
}

async function deleteAvatar() {
  const csrfToken = sessionStorage.getItem("csrf_token");
  const response = await fetch("/api/profile/avatar", {
    method: "DELETE",
    headers: {
      ...(csrfToken && { "X-CSRF-Token": csrfToken }),
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete avatar");
  }

  return response.json();
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadAvatar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["session"] });
    },
  });
}

export function useDeleteAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAvatar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["session"] });
    },
  });
}
