/**
 * Command Palette Component
 * Global search with Ctrl+K/Cmd+K trigger
 * Requirements: 12.1, 12.2, 12.3, 12.4
 */
import * as React from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Building2,
  FolderKanban,
  CheckSquare,
  KeyRound,
  Loader2,
} from 'lucide-react';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandLoading,
  CommandSeparator,
} from '@/components/ui/command';
import { useSearch } from '../hooks/use-search';
import { useCommandPalette } from '../hooks/use-command-palette';
import type {
  ClientSearchResult,
  ProjectSearchResult,
  TaskSearchResult,
  NoteSearchResult,
} from '../types';

/**
 * Command Palette with global search
 * Opens with Ctrl+K (Windows/Linux) or Cmd+K (Mac)
 */
export function CommandPalette() {
  const navigate = useNavigate();
  const { open, setOpen, query, setQuery, debouncedQuery } = useCommandPalette();

  const { data: results, isLoading } = useSearch({
    query: debouncedQuery,
    limit: 5,
    enabled: debouncedQuery.length > 0,
  });

  const hasResults =
    results &&
    (results.clients.length > 0 ||
      results.projects.length > 0 ||
      results.tasks.length > 0 ||
      results.notes.length > 0);

  const handleSelect = React.useCallback(
    (type: string, id: string, projectId?: string) => {
      setOpen(false);
      setQuery('');

      switch (type) {
        case 'client':
          navigate({ to: '/app/clients/$clientId', params: { clientId: id } });
          break;
        case 'project':
          navigate({ to: '/app/projects/$projectId', params: { projectId: id } });
          break;
        case 'task':
          // Navigate to project board with task
          if (projectId) {
            navigate({
              to: '/app/projects/$projectId/board',
              params: { projectId },
            });
          }
          break;
        case 'note':
          // Navigate to notes page
          if (projectId) {
            navigate({
              to: '/app/projects/$projectId/notes',
              params: { projectId },
            });
          } else {
            navigate({ to: '/app/notes' });
          }
          break;
      }
    },
    [navigate, setOpen, setQuery]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search clients, projects, tasks, notes..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {isLoading && debouncedQuery.length > 0 && (
          <CommandLoading>
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Searching...</span>
            </div>
          </CommandLoading>
        )}

        {!isLoading && debouncedQuery.length > 0 && !hasResults && (
          <CommandEmpty>No results found.</CommandEmpty>
        )}

        {debouncedQuery.length === 0 && (
          <CommandEmpty>Type to search...</CommandEmpty>
        )}

        {results && results.clients.length > 0 && (
          <CommandGroup heading="Clients">
            {results.clients.map((client: ClientSearchResult) => (
              <CommandItem
                key={`client-${client.id}`}
                value={`client-${client.id}-${client.name}`}
                onSelect={() => handleSelect('client', client.id)}
              >
                <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span>{client.name}</span>
                  {client.email && (
                    <span className="text-xs text-muted-foreground">
                      {client.email}
                    </span>
                  )}
                </div>
                <span className="ml-auto text-xs text-muted-foreground">
                  {client.status}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results && results.clients.length > 0 && results.projects.length > 0 && (
          <CommandSeparator />
        )}

        {results && results.projects.length > 0 && (
          <CommandGroup heading="Projects">
            {results.projects.map((project: ProjectSearchResult) => (
              <CommandItem
                key={`project-${project.id}`}
                value={`project-${project.id}-${project.name}`}
                onSelect={() => handleSelect('project', project.id)}
              >
                <FolderKanban className="mr-2 h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span>{project.name}</span>
                  {project.clientName && (
                    <span className="text-xs text-muted-foreground">
                      {project.clientName}
                    </span>
                  )}
                </div>
                <span className="ml-auto text-xs text-muted-foreground">
                  {project.status}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results && results.projects.length > 0 && results.tasks.length > 0 && (
          <CommandSeparator />
        )}

        {results && results.tasks.length > 0 && (
          <CommandGroup heading="Tasks">
            {results.tasks.map((task: TaskSearchResult) => (
              <CommandItem
                key={`task-${task.id}`}
                value={`task-${task.id}-${task.title}`}
                onSelect={() => handleSelect('task', task.id, task.projectId)}
              >
                <CheckSquare className="mr-2 h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span>{task.title}</span>
                  {task.projectName && (
                    <span className="text-xs text-muted-foreground">
                      {task.projectName}
                    </span>
                  )}
                </div>
                <span className="ml-auto text-xs text-muted-foreground">
                  {task.status}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results && results.tasks.length > 0 && results.notes.length > 0 && (
          <CommandSeparator />
        )}

        {results && results.notes.length > 0 && (
          <CommandGroup heading="Notes">
            {results.notes.map((note: NoteSearchResult) => (
              <CommandItem
                key={`note-${note.id}`}
                value={`note-${note.id}-${note.systemName}`}
                onSelect={() =>
                  handleSelect('note', note.id, note.projectId ?? undefined)
                }
              >
                <KeyRound className="mr-2 h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span>{note.systemName}</span>
                  {note.projectName && (
                    <span className="text-xs text-muted-foreground">
                      {note.projectName}
                    </span>
                  )}
                </div>
                <span className="ml-auto text-xs text-muted-foreground">
                  {note.type}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
