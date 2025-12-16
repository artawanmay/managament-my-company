/**
 * TaskForm component
 * Form for creating and editing tasks
 * Requirements: 1.1, 4.3, 5.1, 5.3
 */
import { useState, useEffect } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { Loader2 } from 'lucide-react';
import type { Task, CreateTaskInput, UpdateTaskInput } from '../types';
import { TASK_STATUS_VALUES, PRIORITY_VALUES, PRIORITY_CONFIG, KANBAN_COLUMNS, type TaskStatus, type Priority } from '../types';

const taskFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(5000).optional(),
  status: z.enum(TASK_STATUS_VALUES),
  priority: z.enum(PRIORITY_VALUES),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
  estimatedHours: z.string().optional(),
});

type TaskFormData = z.infer<typeof taskFormSchema>;

interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  projectId?: string;
  users?: Array<{ id: string; name: string }>;
  onSubmit: (data: CreateTaskInput | UpdateTaskInput) => Promise<void>;
  isLoading?: boolean;
}

export function TaskForm({
  open,
  onOpenChange,
  task,
  projectId,
  users = [],
  onSubmit,
  isLoading,
}: TaskFormProps) {
  const isEditing = !!task;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<TaskFormData>({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || 'BACKLOG',
    priority: task?.priority || 'MEDIUM',
    assigneeId: task?.assigneeId || '',
    dueDate: task?.dueDate ? task.dueDate.split('T')[0] : '',
    estimatedHours: task?.estimatedHours?.toString() || '',
  });

  // Reset form state when sheet opens or task changes
  useEffect(() => {
    if (open) {
      setFormData({
        title: task?.title || '',
        description: task?.description || '',
        status: task?.status || 'BACKLOG',
        priority: task?.priority || 'MEDIUM',
        assigneeId: task?.assigneeId || '',
        dueDate: task?.dueDate ? task.dueDate.split('T')[0] : '',
        estimatedHours: task?.estimatedHours?.toString() || '',
      });
      setErrors({});
    }
  }, [open, task]);

  const handleChange = (field: keyof TaskFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when field is modified
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

    // Validate form data
    const result = taskFormSchema.safeParse(formData);
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
      const submitData: CreateTaskInput | UpdateTaskInput = {
        title: formData.title,
        description: formData.description || null,
        status: formData.status as TaskStatus,
        priority: formData.priority as Priority,
        assigneeId: formData.assigneeId || null,
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
        estimatedHours: formData.estimatedHours ? parseFloat(formData.estimatedHours) : null,
      };

      if (!isEditing && projectId) {
        (submitData as CreateTaskInput).projectId = projectId;
      }

      await onSubmit(submitData);
      onOpenChange(false);
      // Reset form
      resetForm();
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      status: 'BACKLOG',
      priority: 'MEDIUM',
      assigneeId: '',
      dueDate: '',
      estimatedHours: '',
    });
    setErrors({});
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Edit Task' : 'Create Task'}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Update the task information below.'
              : 'Fill in the details to create a new task.'}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <SheetBody>
            <div className="grid gap-4">
            {/* Title */}
            <div className="grid gap-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="Enter task title"
              />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title}</p>
              )}
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Enter task description"
                rows={4}
              />
            </div>

            {/* Status and Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleChange('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUS_VALUES.map((s) => {
                      const column = KANBAN_COLUMNS.find((c) => c.id === s);
                      return (
                        <SelectItem key={s} value={s}>
                          {column?.title || s}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => handleChange('priority', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_VALUES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_CONFIG[p].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Assignee */}
            <div className="grid gap-2">
              <Label>Assignee</Label>
              <Select
                value={formData.assigneeId || 'unassigned'}
                onValueChange={(value) =>
                  handleChange('assigneeId', value === 'unassigned' ? '' : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Due Date and Estimated Hours */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => handleChange('dueDate', e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="estimatedHours">Estimated Hours</Label>
                <Input
                  id="estimatedHours"
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.estimatedHours}
                  onChange={(e) => handleChange('estimatedHours', e.target.value)}
                  placeholder="0"
                />
              </div>
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
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? 'Saving...' : isEditing ? 'Update Task' : 'Create Task'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
