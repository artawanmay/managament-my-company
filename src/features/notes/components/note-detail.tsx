/**
 * NoteDetail component for displaying note information
 * Requirements: 7.1, 7.7
 */
import { Key, Server, User, Globe, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { NoteType } from "@/lib/db/schema";
import type { Note } from "../types";

interface NoteDetailProps {
  note: Note;
  onViewSecret?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const typeColors: Record<NoteType, string> = {
  API: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  RDP: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  SSH: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  DB: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  OTHER: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

const typeIcons: Record<NoteType, React.ReactNode> = {
  API: <Globe className="h-4 w-4" />,
  RDP: <Server className="h-4 w-4" />,
  SSH: <Server className="h-4 w-4" />,
  DB: <Server className="h-4 w-4" />,
  OTHER: <Key className="h-4 w-4" />,
};

export function NoteDetail({
  note,
  onViewSecret,
  onEdit,
  onDelete,
}: NoteDetailProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              {typeIcons[note.type as NoteType]}
              {note.systemName}
            </CardTitle>
            <CardDescription>
              <Badge
                className={typeColors[note.type as NoteType]}
                variant="outline"
              >
                {note.type}
              </Badge>
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {onViewSecret && (
              <Button variant="outline" size="sm" onClick={onViewSecret}>
                <Key className="mr-1 h-4 w-4" />
                View Secret
              </Button>
            )}
            {onEdit && (
              <Button variant="outline" size="sm" onClick={onEdit}>
                Edit
              </Button>
            )}
            {onDelete && (
              <Button variant="destructive" size="sm" onClick={onDelete}>
                Delete
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {/* Connection details */}
          <div className="grid gap-2">
            {note.host && (
              <div className="flex items-center gap-2 text-sm">
                <Server className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Host:</span>
                <span className="font-mono">
                  {note.host}
                  {note.port && `:${note.port}`}
                </span>
              </div>
            )}
            {note.username && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Username:</span>
                <span className="font-mono">{note.username}</span>
              </div>
            )}
          </div>

          {/* Secret (masked) */}
          <div className="flex items-center gap-2 text-sm">
            <Key className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Secret:</span>
            <span className="font-mono text-muted-foreground">••••••••</span>
          </div>

          {/* Timestamps */}
          <div className="border-t pt-4">
            <div className="grid gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                <span>Created: {formatDate(note.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                <span>Updated: {formatDate(note.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
