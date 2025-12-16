/**
 * Project Files Page
 * Requirements: 13.1, 13.2, 13.3, 13.4
 */
import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
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
  FilesTable,
  FileUpload,
  useFiles,
  useUploadFile,
  useDeleteFile,
  useDownloadFile,
  type FileItem,
} from '@/features/files';

export const Route = createFileRoute('/app/projects/$projectId/files')({
  component: ProjectFilesPage,
});

function ProjectFilesPage() {
  const { projectId } = Route.useParams();
  const { toast } = useToast();
  const [deletingFile, setDeletingFile] = useState<FileItem | null>(null);

  // Fetch files for this project
  const { data: filesData, isLoading } = useFiles(projectId);
  const files = filesData?.data || [];

  // Mutations
  const uploadFile = useUploadFile();
  const deleteFile = useDeleteFile();
  const downloadFile = useDownloadFile();

  const handleUpload = async (file: File) => {
    try {
      await uploadFile.mutateAsync({ projectId, file });
      toast({
        title: 'File uploaded',
        description: `${file.name} has been uploaded successfully.`,
      });
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload file',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleDownload = async (file: FileItem) => {
    try {
      await downloadFile.mutateAsync({ fileId: file.id, fileName: file.fileName });
    } catch (error) {
      toast({
        title: 'Download failed',
        description: error instanceof Error ? error.message : 'Failed to download file',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = (file: FileItem) => {
    setDeletingFile(file);
  };

  const handleConfirmDelete = async () => {
    if (!deletingFile) return;

    try {
      await deleteFile.mutateAsync({ fileId: deletingFile.id, projectId });
      toast({
        title: 'File deleted',
        description: `${deletingFile.fileName} has been deleted successfully.`,
      });
      setDeletingFile(null);
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Failed to delete file',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Project Files</h2>
        <p className="text-muted-foreground">
          Upload and manage files for this project
        </p>
      </div>

      {/* File Upload */}
      <FileUpload
        onUpload={handleUpload}
        isUploading={uploadFile.isPending}
      />

      {/* Files Table */}
      <FilesTable
        data={files}
        isLoading={isLoading}
        onDownload={handleDownload}
        onDelete={handleDelete}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingFile} onOpenChange={(open) => !open && setDeletingFile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingFile?.fileName}"? This action cannot be undone.
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
