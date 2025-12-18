import { pgTable, text, index, unique } from "drizzle-orm/pg-core";
import { tagsSqlite } from "./tags";

// Taggable type values
export const taggableTypeValues = ["TASK", "PROJECT", "NOTE"] as const;
export type TaggableType = (typeof taggableTypeValues)[number];

// Taggables Table (Polymorphic Join) - PostgreSQL
export const taggablesSqlite = pgTable(
  "taggables",
  {
    id: text("id").primaryKey(),
    tagId: text("tag_id")
      .notNull()
      .references(() => tagsSqlite.id, { onDelete: "cascade" }),
    taggableType: text("taggable_type", { enum: taggableTypeValues }).notNull(),
    taggableId: text("taggable_id").notNull(), // ID of the tagged entity
  },
  (table) => [
    index("taggables_tag_id_idx").on(table.tagId),
    index("taggables_taggable_idx").on(table.taggableType, table.taggableId),
    unique("taggables_unique").on(
      table.tagId,
      table.taggableType,
      table.taggableId
    ),
  ]
);

// Export types
export type Taggable = typeof taggablesSqlite.$inferSelect;
export type NewTaggable = typeof taggablesSqlite.$inferInsert;
