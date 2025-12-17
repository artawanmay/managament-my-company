/**
 * FilesTable component with TanStack Table
 * Requirements: 13.2 - Show sortable table with file name, size, type, uploader, and date
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
  Download,
  Trash2,
  FileIcon,
  FileText,
  FileImage,
  FileArchive,
  FileCode,
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
import { formatDistanceToNow } from "date-fns";
import type { FileItem } from "../types";
import { formatFileSize, getFileCategory } from "../types";

interface FilesTableProps {
  data: FileItem[];
  onDownload?: (file: FileItem) => void;
  onDelete?: (file: FileItem) => void;
  isLoading?: boolean;
}

const categoryColors: Record<string, string> = {
  Document: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  Spreadsheet:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  Presentation:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  Image:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  Archive:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  Code: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300",
  Other: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

function getFileIcon(mimeType: string) {
  const category = getFileCategory(mimeType);
  switch (category) {
    case "Document":
      return <FileText className="h-4 w-4" />;
    case "Image":
      return <FileImage className="h-4 w-4" />;
    case "Archive":
      return <FileArchive className="h-4 w-4" />;
    case "Code":
      return <FileCode className="h-4 w-4" />;
    default:
      return <FileIcon className="h-4 w-4" />;
  }
}

export function FilesTable({
  data,
  onDownload,
  onDelete,
  isLoading,
}: FilesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns: ColumnDef<FileItem>[] = useMemo(
    () => [
      {
        accessorKey: "fileName",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            File Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const file = row.original;
          return (
            <div className="flex items-center gap-2">
              {getFileIcon(file.mimeType)}
              <span className="font-medium">{row.getValue("fileName")}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "mimeType",
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
          const mimeType = row.getValue("mimeType") as string;
          const category = getFileCategory(mimeType);
          return (
            <Badge className={categoryColors[category]} variant="outline">
              {category}
            </Badge>
          );
        },
      },
      {
        accessorKey: "size",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Size
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => formatFileSize(row.getValue("size")),
      },
      {
        accessorKey: "uploaderName",
        header: "Uploaded By",
        cell: ({ row }) => row.getValue("uploaderName") || "Unknown",
      },
      {
        accessorKey: "uploadedAt",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Uploaded
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const date = row.getValue("uploadedAt");
          if (!date) return "-";
          return formatDistanceToNow(new Date(date as string), {
            addSuffix: true,
          });
        },
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const file = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onDownload && (
                  <DropdownMenuItem onClick={() => onDownload(file)}>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(file)}
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
    [onDownload, onDelete]
  );

  const table = useReactTable({
    data,
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
        <div className="text-muted-foreground">Loading files...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search files..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />
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
                  No files found
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
