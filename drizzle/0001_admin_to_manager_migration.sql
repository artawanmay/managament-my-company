-- Migration: Remove ADMIN role and migrate existing ADMIN users to MANAGER
-- Requirements: 1.2, 1.3

-- Update all users with ADMIN role to MANAGER
UPDATE users SET role = 'MANAGER' WHERE role = 'ADMIN';
