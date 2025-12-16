/**
 * User feature types
 * Requirements: 2.2, 2.3
 */
import { type Role } from '@/lib/db/schema/users';

export type { Role };

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserListParams {
  search?: string;
  role?: Role;
  sortBy?: 'name' | 'email' | 'role' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface UserListResponse {
  data: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role?: Role;
  avatarUrl?: string | null;
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  avatarUrl?: string | null;
}

export interface UpdateUserRoleInput {
  role: Role;
}
