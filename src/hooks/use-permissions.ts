/**
 * usePermissions Hook
 * 
 * Hook untuk mengelola permission berdasarkan role user.
 * Digunakan untuk filtering sidebar dan route protection.
 */
import { useMemo } from 'react';
import { useSession } from '@/features/auth/hooks';
import type { Role } from '@/lib/db/schema/users';

/**
 * Permission actions untuk sidebar visibility
 */
export type SidebarPermission =
  | 'view_dashboard'
  | 'view_clients'
  | 'view_projects'
  | 'view_tasks'
  | 'view_notes'
  | 'view_users';

/**
 * Permission matrix untuk sidebar berdasarkan role
 * 
 * SUPER_ADMIN: Semua menu
 * MANAGER: Dashboard, Clients, Projects, Tasks, Notes (tanpa Users)
 * MEMBER: Dashboard, Tasks saja
 * GUEST: Tidak ada akses
 */
const SIDEBAR_PERMISSION_MATRIX: Record<Role, Set<SidebarPermission>> = {
  SUPER_ADMIN: new Set([
    'view_dashboard',
    'view_clients',
    'view_projects',
    'view_tasks',
    'view_notes',
    'view_users',
  ]),
  MANAGER: new Set([
    'view_dashboard',
    'view_clients',
    'view_projects',
    'view_tasks',
    'view_notes',
  ]),
  MEMBER: new Set([
    'view_dashboard',
    'view_tasks',
  ]),
  GUEST: new Set([]),
};

export interface SidebarModule {
  title: string;
  href: string;
  requiredPermission: SidebarPermission;
}

/**
 * Konfigurasi sidebar modules dengan permission yang dibutuhkan
 */
export const SIDEBAR_MODULES: SidebarModule[] = [
  { title: 'Dashboard', href: '/app/dashboard', requiredPermission: 'view_dashboard' },
  { title: 'Clients', href: '/app/clients', requiredPermission: 'view_clients' },
  { title: 'Projects', href: '/app/projects', requiredPermission: 'view_projects' },
  { title: 'Tasks', href: '/app/tasks', requiredPermission: 'view_tasks' },
  { title: 'Notes', href: '/app/notes', requiredPermission: 'view_notes' },
  { title: 'Users', href: '/app/users', requiredPermission: 'view_users' },
];

interface UsePermissionsReturn {
  /** Role user saat ini */
  role: Role | null;
  /** Cek apakah user memiliki permission tertentu */
  hasPermission: (permission: SidebarPermission) => boolean;
  /** Dapatkan daftar sidebar modules yang visible untuk user */
  getVisibleSidebarModules: () => SidebarModule[];
  /** Loading state */
  isLoading: boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const { user, isLoading } = useSession();
  
  const role = (user?.role as Role) ?? null;

  const hasPermission = useMemo(() => {
    return (permission: SidebarPermission): boolean => {
      if (!role) return false;
      return SIDEBAR_PERMISSION_MATRIX[role]?.has(permission) ?? false;
    };
  }, [role]);

  const getVisibleSidebarModules = useMemo(() => {
    return (): SidebarModule[] => {
      if (!role) return [];
      return SIDEBAR_MODULES.filter(module => 
        SIDEBAR_PERMISSION_MATRIX[role]?.has(module.requiredPermission) ?? false
      );
    };
  }, [role]);

  return useMemo(
    () => ({
      role,
      hasPermission,
      getVisibleSidebarModules,
      isLoading,
    }),
    [role, hasPermission, getVisibleSidebarModules, isLoading]
  );
}
