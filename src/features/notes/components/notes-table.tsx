/**
 * NotesTable component with TanStack Table
 * Requirements: 7.1, 7.7
 */
import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  MoreHorizontal,
  Pencil,
  Trash2,
  Key,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { noteTypeValues, type NoteType } from "@/lib/db/schema";
import type { Note } from "../types";

interface NotesTableProps {
  data: Note[];
  onEdit?: (note: Note) => void;
  onDelete?: (note: Note) => void;
  onViewSecret?: (note: Note) => void;
  onFetchSecret?: (noteId: string) => Promise<string>;
  isLoading?: boolean;
}

const typeColors: Record<NoteType, string> = {
  API: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  RDP: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  SSH: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  DB: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  OTHER: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

export function NotesTable({
  data,
  onEdit,
  onDelete,
  onViewSecret,
  onFetchSecret,
  isLoading,
}: NotesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<NoteType | "ALL">("ALL");
  // Track which secrets are visible (by note id)
  const [visibleSecrets, setVisibleSecrets] = useState<
    Record<string, string | null>
  >({});
  const [loadingSecrets, setLoadingSecrets] = useState<Record<string, boolean>>(
    {}
  );

  const filteredData = useMemo(() => {
    if (typeFilter === "ALL") return data;
    return data.filter((note) => note.type === typeFilter);
  }, [data, typeFilter]);

  const columns: ColumnDef<Note>[] = useMemo(
    () => [
      {
        accessorKey: "systemName",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            System Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.getValue("systemName")}</span>
        ),
      },
      {
        accessorKey: "type",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Type
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const type = row.getValue("type") as NoteType;
          return (
            <Badge className={typeColors[type]} variant="outline">
              {type}
            </Badge>
          );
        },
      },
      {
        accessorKey: "host",
        header: "Host",
        cell: ({ row }) => row.getValue("host") || "-",
      },
      {
        accessorKey: "port",
        header: "Port",
        cell: ({ row }) => row.getValue("port") || "-",
      },
      {
        accessorKey: "username",
        header: "Username",
        cell: ({ row }) => row.getValue("username") || "-",
      },
      {
        id: "secret",
        header: "Secret",
        cell: ({ row }) => {
          const note = row.original;
          const isVisible = visibleSecrets[note.id] !== undefined;
          const secretValue = visibleSecrets[note.id];
          const isLoadingSecret = loadingSecrets[note.id];

          const handleToggleSecret = async () => {
            if (isVisible) {
              // Hide secret
              setVisibleSecrets((prev) => {
                const newState = { ...prev };
                delete newState[note.id];
                return newState;
              });
            } else if (onFetchSecret) {
              // Fetch and show secret
              setLoadingSecrets((prev) => ({ ...prev, [note.id]: true }));
              try {
                const secret = await onFetchSecret(note.id);
                setVisibleSecrets((prev) => ({ ...prev, [note.id]: secret }));
              } catch {
                // Error handled by parent
              } finally {
                setLoadingSecrets((prev) => ({ ...prev, [note.id]: false }));
              }
            }
          };

          return (
            <div className="flex items-center gap-2">
              <span className="font-mono text-muted-foreground min-w-[80px]">
                {isLoadingSecret ? (
                  <span className="text-xs">Loading...</span>
                ) : isVisible && secretValue ? (
                  <span className="text-foreground break-all">
                    {secretValue}
                  </span>
                ) : (
                  "••••••••"
                )}
              </span>
              {onFetchSecret && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={handleToggleSecret}
                  disabled={isLoadingSecret}
                  title={isVisible ? "Hide secret" : "Show secret"}
                >
                  {isVisible ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              )}
            </div>
          );
        },
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const note = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onViewSecret && (
                  <DropdownMenuItem onClick={() => onViewSecret(note)}>
                    <Key className="mr-2 h-4 w-4" />
                    View Secret
                  </DropdownMenuItem>
                )}
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(note)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(note)}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [
      onEdit,
      onDelete,
      onViewSecret,
      onFetchSecret,
      visibleSecrets,
      loadingSecrets,
    ]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Loading notes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search notes..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />
        <Select
          value={typeFilter}
          onValueChange={(value) => setTypeFilter(value as NoteType | "ALL")}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            {noteTypeValues.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <table className="w-full">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-sm font-medium text-muted-foreground"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No notes found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t transition-colors hover:bg-muted/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-sm">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
