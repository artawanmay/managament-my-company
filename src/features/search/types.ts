/**
 * Search Feature Types
 * Requirements: 11.1, 11.2, 11.3
 */

export interface ClientSearchResult {
  id: string;
  name: string;
  email: string | null;
  status: string;
}

export interface ProjectSearchResult {
  id: string;
  name: string;
  status: string;
  clientName: string | null;
}

export interface TaskSearchResult {
  id: string;
  title: string;
  status: string;
  projectId: string;
  projectName: string | null;
}

export interface NoteSearchResult {
  id: string;
  systemName: string;
  type: string;
  projectId: string | null;
  projectName: string | null;
}

export interface SearchResults {
  clients: ClientSearchResult[];
  projects: ProjectSearchResult[];
  tasks: TaskSearchResult[];
  notes: NoteSearchResult[];
}

export interface SearchResponse {
  data: SearchResults;
}

export type SearchResultType = "client" | "project" | "task" | "note";

export interface SearchResultItem {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string | null;
  status?: string;
  href: string;
}
