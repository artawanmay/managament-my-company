/**
 * NoteForm component for create/edit
 * Requirements: 7.1, 1.1, 4.3
 */
import { useState, useEffect, useRef } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetBody,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { noteTypeValues, type NoteType } from '@/lib/db/schema';
import type { Note, CreateNoteInput, UpdateNoteInput } from '../types';

// Zod schema for note form validation
const noteFormSchema = z.object({
  type: z.enum(noteTypeValues),
  systemName: z.string().min(1, 'System name is required').max(255),
  host: z.string().max(255).optional(),
  port: z.coerce.number().int().min(1).max(65535).optional().or(z.literal('')),
  username: z.string().max(255).optional(),
  secret: z.string().min(1, 'Secret is required'),
});

type NoteFormData = {
  type: NoteType;
  systemName: string;
  host: string;
  port: string;
  username: string;
  secret: string;
};

interface NoteFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note?: Note | null;
  projectId?: string;
  clientId?: string;
  onSubmit: (data: CreateNoteInput | UpdateNoteInput) => Promise<void>;
  isLoading?: boolean;
}

// Helper to create initial form data
function getInitialFormData(note?: Note | null): NoteFormData {
  return {
    type: (note?.type as NoteType) || 'OTHER',
    systemName: note?.systemName || '',
    host: note?.host || '',
    port: note?.port?.toString() || '',
    username: note?.username || '',
    secret: '', // Never pre-fill secret for security
  };
}

export function NoteForm({
  open,
  onOpenChange,
  note,
  projectId,
  clientId,
  onSubmit,
  isLoading,
}: NoteFormProps) {
  const isEditing = !!note;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<NoteFormData>(() => getInitialFormData(note));

  // Store note in ref to access latest value without adding to dependencies
  const noteRef = useRef(note);
  noteRef.current = note;

  // Use primitive values ONLY for dependencies to prevent infinite loops
  const noteId = note?.id ?? null;

  // Reset form only when sheet opens OR when note ID changes
  useEffect(() => {
    if (open) {
      setFormData(getInitialFormData(noteRef.current));
      setErrors({});
    }
  }, [open, noteId]);

  const handleChange = (field: keyof NoteFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // For editing, secret is optional
    const schemaToUse = isEditing
      ? noteFormSchema.extend({
          secret: z.string().optional(),
        })
      : noteFormSchema;

    const result = schemaToUse.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          fieldErrors[issue.path[0] as string] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    try {
      const submitData: CreateNoteInput | UpdateNoteInput = {
        type: formData.type,
        systemName: formData.systemName,
        host: formData.host || null,
        port: formData.port ? parseInt(formData.port, 10) : null,
        username: formData.username || null,
        projectId: projectId || null,
        clientId: clientId || null,
      };

      // Only include secret if provided
      if (formData.secret) {
        submitData.secret = formData.secret;
      }

      await onSubmit(submitData);
      onOpenChange(false);
      setFormData({
        type: 'OTHER',
        systemName: '',
        host: '',
        port: '',
        username: '',
        secret: '',
      });
      setErrors({});
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Edit Note' : 'Create Note'}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Update the credential information below. Leave secret empty to keep the existing value.'
              : 'Fill in the details to create a new credential note.'}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <SheetBody>
            <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="type">Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => handleChange('type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {noteTypeValues.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="systemName">System Name *</Label>
              <Input
                id="systemName"
                value={formData.systemName}
                onChange={(e) => handleChange('systemName', e.target.value)}
                placeholder="e.g., Production Database, AWS API"
              />
              {errors.systemName && (
                <p className="text-sm text-destructive">{errors.systemName}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="host">Host</Label>
                <Input
                  id="host"
                  value={formData.host}
                  onChange={(e) => handleChange('host', e.target.value)}
                  placeholder="e.g., db.example.com"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  type="number"
                  value={formData.port}
                  onChange={(e) => handleChange('port', e.target.value)}
                  placeholder="e.g., 5432"
                  min={1}
                  max={65535}
                />
                {errors.port && (
                  <p className="text-sm text-destructive">{errors.port}</p>
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => handleChange('username', e.target.value)}
                placeholder="e.g., admin"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="secret">
                Secret {isEditing ? '(leave empty to keep existing)' : '*'}
              </Label>
              <Textarea
                id="secret"
                value={formData.secret}
                onChange={(e) => handleChange('secret', e.target.value)}
                placeholder="Password, API key, or other secret value"
                rows={3}
                className="font-mono"
              />
              {errors.secret && (
                <p className="text-sm text-destructive">{errors.secret}</p>
              )}
            </div>
            </div>
          </SheetBody>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
