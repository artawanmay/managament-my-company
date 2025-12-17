/**
 * Profile Query Hook
 *
 * Requirements:
 * - 16.4: Profile management
 */
import { useQuery } from "@tanstack/react-query";
import { getUserProfile } from "../api";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: getUserProfile,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
