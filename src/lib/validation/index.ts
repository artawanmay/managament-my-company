/**
 * Centralized Zod validation schemas for all entities
 * Requirements: 18.6 - THE System SHALL validate all API inputs using Zod schemas
 */

export * from './schemas/client';
export * from './schemas/project';
export * from './schemas/task';
export * from './schemas/note';
export * from './schemas/comment';
export * from './schemas/tag';
export * from './schemas/user';
export * from './schemas/auth';
export * from './schemas/common';
export * from './middleware';
