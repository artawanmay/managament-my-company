/**
 * TagSelector component
 * Allows selecting and attaching tags to entities
 */
import * as React from "react";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTags, useAttachTag, useDetachTag } from "../hooks";
import { TagBadge } from "./tag-badge";
import type { Tag } from "../types";

interface TagSelectorProps {
  entityType: "TASK" | "PROJECT" | "NOTE";
  entityId: string;
  selectedTags: Tag[];
  onTagsChange?: (tags: Tag[]) => void;
  disabled?: boolean;
  className?: string;
}

export function TagSelector({
  entityType,
  entityId,
  selectedTags,
  onTagsChange,
  disabled = false,
  className,
}: TagSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const { data: tagsData, isLoading } = useTags({ limit: 100 });
  const attachTag = useAttachTag();
  const detachTag = useDetachTag();

  const availableTags = tagsData?.data ?? [];
  const selectedTagIds = new Set(selectedTags.map((t) => t.id));

  const filteredTags = availableTags.filter(
    (tag) =>
      tag.name.toLowerCase().includes(search.toLowerCase()) &&
      !selectedTagIds.has(tag.id)
  );

  const handleSelect = async (tag: Tag) => {
    try {
      await attachTag.mutateAsync({
        tagId: tag.id,
        data: {
          taggableType: entityType,
          taggableId: entityId,
        },
      });
      onTagsChange?.([...selectedTags, tag]);
    } catch (error) {
      console.error("Failed to attach tag:", error);
    }
  };

  const handleRemove = async (tag: Tag) => {
    try {
      await detachTag.mutateAsync({
        tagId: tag.id,
        data: {
          taggableType: entityType,
          taggableId: entityId,
        },
      });
      onTagsChange?.(selectedTags.filter((t) => t.id !== tag.id));
    } catch (error) {
      console.error("Failed to detach tag:", error);
    }
  };

  const isProcessing = attachTag.isPending || detachTag.isPending;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Selected tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map((tag) => (
            <TagBadge
              key={tag.id}
              tag={tag}
              size="sm"
              onRemove={disabled ? undefined : () => handleRemove(tag)}
            />
          ))}
        </div>
      )}

      {/* Tag selector */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-8 justify-between text-xs"
            disabled={disabled || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-3 w-3" />
                Add tag
                <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
              </>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search tags..."
              value={search}
              onValueChange={setSearch}
              className="h-9"
            />
            <CommandList>
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                <>
                  <CommandEmpty>No tags found.</CommandEmpty>
                  <CommandGroup>
                    {filteredTags.map((tag) => (
                      <CommandItem
                        key={tag.id}
                        value={tag.name}
                        onSelect={() => {
                          handleSelect(tag);
                          setOpen(false);
                          setSearch("");
                        }}
                        className="flex items-center gap-2"
                      >
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="flex-1">{tag.name}</span>
                        {selectedTagIds.has(tag.id) && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
