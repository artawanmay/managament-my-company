/**
 * Global Notes Page
 * Requirements: 7.1, 7.3
 */
import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  NotesTable,
  NoteForm,
  SecretViewer,
  useNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  useViewSecret,
  type Note,
  type CreateNoteInput,
  type UpdateNoteInput,
} from '@/features/notes';

export const Route = createFileRoute('/app/notes')({
  component: NotesPage,
});

function NotesPage() {
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [deletingNote, setDeletingNote] = useState<Note | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const [viewedSecret, setViewedSecret] = useState<string | null>(null);
  const [secretError, setSecretError] = useState<string | null>(null);

  // Fetch notes
  const { data: notesData, isLoading } = useNotes();
  const notes = notesData?.data || [];

  // Mutations
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const viewSecret = useViewSecret();

  const handleCreate = () => {
    setEditingNote(null);
    setIsFormOpen(true);
  };

  const handleEdit = (note: Note) => {
    setEditingNote(note);
    setIsFormOpen(true);
  };

  const handleDelete = (note: Note) => {
    setDeletingNote(note);
  };

  const handleViewSecret = (note: Note) => {
    setViewingNote(note);
    setViewedSecret(null);
    setSecretError(null);
  };

  const handleRequestSecret = async () => {
    if (!viewingNote) return;

    try {
      const result = await viewSecret.mutateAsync(viewingNote.id);
      setViewedSecret(result.data.secret);
      setSecretError(null);
    } catch (error) {
      setSecretError(error instanceof Error ? error.message : 'Failed to view secret');
      setViewedSecret(null);
    }
  };

  // Fetch secret for inline toggle in table
  const handleFetchSecret = async (noteId: string): Promise<string> => {
    const result = await viewSecret.mutateAsync(noteId);
    return result.data.secret;
  };

  const handleFormSubmit = async (data: CreateNoteInput | UpdateNoteInput) => {
    try {
      if (editingNote) {
        await updateNote.mutateAsync({
          noteId: editingNote.id,
          data: data as UpdateNoteInput,
        });
        toast({
          title: 'Note updated',
          description: 'The note has been updated successfully.',
        });
      } else {
        await createNote.mutateAsync(data as CreateNoteInput);
        toast({
          title: 'Note created',
          description: 'The note has been created successfully.',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingNote) return;

    try {
      await deleteNote.mutateAsync(deletingNote.id);
      toast({
        title: 'Note deleted',
        description: 'The note has been deleted successfully.',
      });
      setDeletingNote(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete note',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notes</h1>
          <p className="text-muted-foreground">
            Manage credentials and secure notes
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Note
        </Button>
      </div>

      <NotesTable
        data={notes}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onViewSecret={handleViewSecret}
        onFetchSecret={handleFetchSecret}
      />

      {/* Create/Edit Form */}
      <NoteForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        note={editingNote}
        onSubmit={handleFormSubmit}
        isLoading={createNote.isPending || updateNote.isPending}
      />

      {/* Secret Viewer */}
      <SecretViewer
        open={!!viewingNote}
        onOpenChange={(open) => {
          if (!open) {
            setViewingNote(null);
            setViewedSecret(null);
            setSecretError(null);
          }
        }}
        note={viewingNote}
        secret={viewedSecret}
        isLoading={viewSecret.isPending}
        error={secretError}
        onRequestSecret={handleRequestSecret}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingNote} onOpenChange={(open) => !open && setDeletingNote(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingNote?.systemName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
