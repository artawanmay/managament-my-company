/**
 * SecretViewer component for showing/copying secrets
 * Requirements: 7.3, 7.6, 7.7
 */
import { useState } from 'react';
import { Eye, EyeOff, Copy, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { Note } from '../types';

interface SecretViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: Note | null;
  secret: string | null;
  isLoading?: boolean;
  error?: string | null;
  onRequestSecret: () => void;
}

export function SecretViewer({
  open,
  onOpenChange,
  note,
  secret,
  isLoading,
  error,
  onRequestSecret,
}: SecretViewerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    if (!secret) return;

    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: 'Secret copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: 'Failed to copy',
        description: 'Could not copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    setCopied(false);
    onOpenChange(false);
  };

  // Request secret when dialog opens and secret is not loaded
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && !secret && !isLoading && !error) {
      onRequestSecret();
    }
    if (!newOpen) {
      handleClose();
    } else {
      onOpenChange(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>View Secret</DialogTitle>
          <DialogDescription>
            {note?.systemName} ({note?.type})
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading secret...</span>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 p-4 text-destructive">
              {error}
            </div>
          )}

          {secret && !isLoading && (
            <div className="space-y-4">
              {/* Connection details */}
              {(note?.host || note?.username) && (
                <div className="space-y-2 text-sm">
                  {note?.host && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Host:</span>
                      <span className="font-mono">
                        {note.host}
                        {note.port && `:${note.port}`}
                      </span>
                    </div>
                  )}
                  {note?.username && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Username:</span>
                      <span className="font-mono">{note.username}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Secret display */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Secret:</span>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsVisible(!isVisible)}
                    >
                      {isVisible ? (
                        <>
                          <EyeOff className="mr-1 h-4 w-4" />
                          Hide
                        </>
                      ) : (
                        <>
                          <Eye className="mr-1 h-4 w-4" />
                          Show
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopy}
                    >
                      {copied ? (
                        <>
                          <Check className="mr-1 h-4 w-4 text-green-500" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1 h-4 w-4" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <div className="rounded-md border bg-muted/50 p-3">
                  <pre className="whitespace-pre-wrap break-all font-mono text-sm">
                    {isVisible ? secret : '••••••••••••••••'}
                  </pre>
                </div>
              </div>

              {/* Security notice */}
              <p className="text-xs text-muted-foreground">
                This access has been logged for security purposes.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
