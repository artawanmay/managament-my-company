/**
 * Tags feature module
 * Provides tag management functionality
 */

// Components
export { TagBadge, TagSelector, TagFilter } from "./components";

// Hooks
export {
  useTags,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
  useAttachTag,
  useDetachTag,
} from "./hooks";

// API
export * from "./api";

// Types
export type {
  Tag,
  Taggable,
  TagWithCount,
  CreateTagInput,
  UpdateTagInput,
  AttachTagInput,
  DetachTagInput,
} from "./types";
