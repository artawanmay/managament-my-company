/**
 * FileUpload component with drag-drop functionality
 * Requirements: 13.1 - Validate file type and size before storing
 */
import { useState, useCallback, useRef } from "react";
import { Upload, X, FileIcon, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  formatFileSize,
  getFileCategory,
} from "../types";

interface FileUploadProps {
  onUpload: (file: File) => Promise<void>;
  isUploading?: boolean;
  uploadProgress?: number;
  className?: string;
}

interface FileValidationResult {
  valid: boolean;
  error?: string;
}

function validateFile(file: File): FileValidationResult {
  // Check file type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `File type "${file.type || "unknown"}" is not allowed. Please upload a supported file type.`,
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds the maximum allowed size of ${formatFileSize(MAX_FILE_SIZE)}.`,
    };
  }

  return { valid: true };
}

export function FileUpload({
  onUpload,
  isUploading,
  uploadProgress,
  className,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setValidationError(null);
    setUploadSuccess(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0]!;
      const validation = validateFile(file);
      if (validation.valid) {
        setSelectedFile(file);
      } else {
        setValidationError(validation.error || "Invalid file");
      }
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setValidationError(null);
      setUploadSuccess(false);

      const files = e.target.files;
      if (files && files.length > 0) {
        const file = files[0]!;
        const validation = validateFile(file);
        if (validation.valid) {
          setSelectedFile(file);
        } else {
          setValidationError(validation.error || "Invalid file");
        }
      }
    },
    []
  );

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    try {
      await onUpload(selectedFile);
      setSelectedFile(null);
      setUploadSuccess(true);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch {
      setValidationError("Failed to upload file. Please try again.");
    }
  }, [selectedFile, onUpload]);

  const handleClearFile = useCallback(() => {
    setSelectedFile(null);
    setValidationError(null);
    setUploadSuccess(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative rounded-lg border-2 border-dashed p-8 text-center transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
          isUploading && "pointer-events-none opacity-50"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          accept={ALLOWED_MIME_TYPES.join(",")}
          className="hidden"
          disabled={isUploading}
        />

        <div className="flex flex-col items-center gap-4">
          <div className="rounded-full bg-muted p-4">
            <Upload className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="text-lg font-medium">
              {isDragging
                ? "Drop your file here"
                : "Drag and drop your file here"}
            </p>
            <p className="text-sm text-muted-foreground">
              or{" "}
              <button
                type="button"
                onClick={handleBrowseClick}
                className="text-primary underline hover:no-underline"
                disabled={isUploading}
              >
                browse
              </button>{" "}
              to choose a file
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Maximum file size: {formatFileSize(MAX_FILE_SIZE)}
          </p>
        </div>
      </div>

      {/* Validation error */}
      {validationError && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Upload success */}
      {uploadSuccess && (
        <div className="flex items-center gap-2 rounded-md bg-green-100 p-3 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          <span>File uploaded successfully!</span>
        </div>
      )}

      {/* Selected file preview */}
      {selectedFile && (
        <div className="rounded-md border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-muted p-2">
                <FileIcon className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {getFileCategory(selectedFile.type)} •{" "}
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClearFile}
              disabled={isUploading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Upload progress */}
          {isUploading && uploadProgress !== undefined && (
            <div className="mt-4 space-y-2">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                Uploading... {uploadProgress}%
              </p>
            </div>
          )}

          {/* Upload button */}
          {!isUploading && (
            <div className="mt-4 flex justify-end">
              <Button onClick={handleUpload}>
                <Upload className="mr-2 h-4 w-4" />
                Upload File
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
