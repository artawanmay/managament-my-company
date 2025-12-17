/**
 * Client feature types
 */
import { type Client, type ClientStatus } from "@/lib/db/schema";

export type { Client, ClientStatus };

export interface ClientWithProjects extends Client {
  projects: {
    id: string;
    name: string;
    status: string;
    priority: string;
    startDate: Date | null;
    endDate: Date | null;
  }[];
}

export interface ClientListParams {
  search?: string;
  status?: ClientStatus;
  sortBy?: "name" | "status" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface ClientListResponse {
  data: Client[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateClientInput {
  name: string;
  picName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  status?: ClientStatus;
  notes?: string | null;
}

export interface UpdateClientInput {
  name?: string;
  picName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  status?: ClientStatus;
  notes?: string | null;
}
