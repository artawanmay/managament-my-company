/**
 * useProfile Hook - Get current user profile
 */
import { useQuery } from "@tanstack/react-query";

interface Profile {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  themePreference: string;
  createdAt: string;
  updatedAt: string;
}

async function fetchProfile(): Promise<Profile> {
  const response = await fetch("/api/profile");
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch profile");
  }
  const data = await response.json();
  return data.data;
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile,
    staleTime: 5 * 60 * 1000,
  });
}
