/**
 * CommentForm component with @mention autocomplete
 * Requirements: 8.1, 8.2
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MentionUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

interface CommentFormProps {
  onSubmit: (message: string) => Promise<void>;
  isSubmitting?: boolean;
  placeholder?: string;
  projectMembers?: MentionUser[];
}

export function CommentForm({
  onSubmit,
  isSubmitting,
  placeholder = 'Write a comment... Use @ to mention someone',
  projectMembers = [],
}: CommentFormProps) {
  const [message, setMessage] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Filter members based on search
  const filteredMembers = projectMembers.filter((member) =>
    member.name.toLowerCase().includes(mentionSearch.toLowerCase()) ||
    member.email.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  // Handle text change and detect @mentions
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart || 0;
    setMessage(value);
    setCursorPosition(position);

    // Check if we're typing a mention
    const textBeforeCursor = value.slice(0, position);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionSearch(mentionMatch[1] || '');
      setShowMentions(true);
      setMentionIndex(0);
    } else {
      setShowMentions(false);
      setMentionSearch('');
    }
  };

  // Insert mention into message
  const insertMention = useCallback((member: MentionUser) => {
    const textBeforeCursor = message.slice(0, cursorPosition);
    const textAfterCursor = message.slice(cursorPosition);

    // Find the @ symbol position
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      const mentionStart = textBeforeCursor.lastIndexOf('@');
      const newText =
        textBeforeCursor.slice(0, mentionStart) +
        `@${member.name.replace(/\s+/g, '')} ` +
        textAfterCursor;

      setMessage(newText);
      setShowMentions(false);
      setMentionSearch('');

      // Focus back on textarea
      setTimeout(() => {
        if (textareaRef.current) {
          const newPosition = mentionStart + member.name.replace(/\s+/g, '').length + 2;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newPosition, newPosition);
        }
      }, 0);
    }
  }, [message, cursorPosition]);

  // Handle keyboard navigation in mention list
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showMentions || filteredMembers.length === 0) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setMentionIndex((prev) =>
          prev < filteredMembers.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setMentionIndex((prev) =>
          prev > 0 ? prev - 1 : filteredMembers.length - 1
        );
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (filteredMembers[mentionIndex]) {
          insertMention(filteredMembers[mentionIndex]);
        }
        break;
      case 'Escape':
        setShowMentions(false);
        break;
    }
  };

  // Close mentions on click outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowMentions(false);
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSubmit = async () => {
    if (!message.trim() || isSubmitting) return;

    try {
      await onSubmit(message.trim());
      setMessage('');
    } catch (error) {
      console.error('Failed to submit comment:', error);
    }
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="min-h-[80px] resize-none pr-12"
            disabled={isSubmitting}
          />
          <Button
            size="sm"
            className="absolute bottom-2 right-2"
            onClick={handleSubmit}
            disabled={!message.trim() || isSubmitting}
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </div>

      {/* Mention autocomplete dropdown */}
      {showMentions && filteredMembers.length > 0 && (
        <div
          className="absolute z-50 mt-1 w-64 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {filteredMembers.map((member, index) => (
            <button
              key={member.id}
              type="button"
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700',
                index === mentionIndex && 'bg-gray-100 dark:bg-gray-700'
              )}
              onClick={() => insertMention(member)}
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={member.avatarUrl || undefined} />
                <AvatarFallback className="text-xs">
                  {member.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{member.name}</p>
                <p className="text-xs text-gray-500 truncate">{member.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {showMentions && filteredMembers.length === 0 && mentionSearch && (
        <div className="absolute z-50 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg p-3">
          <p className="text-sm text-gray-500">No users found</p>
        </div>
      )}
    </div>
  );
}
