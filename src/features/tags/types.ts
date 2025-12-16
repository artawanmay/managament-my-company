/**
 * Tag feature types
 */

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
}

export interface Taggable {
  id: string;
  tagId: string;
  taggableType: 'TASK' | 'PROJECT' | 'NOTE';
  taggableId: string;
}

export interface TagWithCount extends Tag {
  count?: number;
}

export interface CreateTagInput {
  name: string;
  color: string;
}

export interface UpdateTagInput {
  name?: string;
  color?: string;
}

export interface AttachTagInput {
  taggableType: 'TASK' | 'PROJECT' | 'NOTE';
  taggableId: string;
}

export interface DetachTagInput {
  taggableType: 'TASK' | 'PROJECT' | 'NOTE';
  taggableId: string;
}
