/**
 * TagFilter component
 * Allows filtering lists by tags
 */
import * as React from "react";
import { Check, ChevronsUpDown, Filter, Loader2 } from "lucide-react";
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
import { useTags } from "../hooks";
import { TagBadge } from "./tag-badge";
import type { Tag } from "../types";

interface TagFilterProps {
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
  className?: string;
}

export function TagFilter({
  selectedTagIds,
  onTagsChange,
  className,
}: TagFilterProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const { data: tagsData, isLoading } = useTags({ limit: 100 });

  const availableTags = tagsData?.data ?? [];
  const selectedTagIdsSet = new Set(selectedTagIds);

  const selectedTags = availableTags.filter((tag) =>
    selectedTagIdsSet.has(tag.id)
  );

  const filteredTags = availableTags.filter((tag) =>
    tag.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = (tag: Tag) => {
    if (selectedTagIdsSet.has(tag.id)) {
      onTagsChange(selectedTagIds.filter((id) => id !== tag.id));
    } else {
      onTagsChange([...selectedTagIds, tag.id]);
    }
  };

  const handleClear = () => {
    onTagsChange([]);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Selected tag badges */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {selectedTags.map((tag) => (
            <TagBadge
              key={tag.id}
              tag={tag}
              size="sm"
              onRemove={() => handleToggle(tag)}
            />
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Tag filter dropdown */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "h-8 justify-between text-xs",
              selectedTagIds.length > 0 && "border-primary"
            )}
          >
            <Filter className="mr-2 h-3 w-3" />
            {selectedTagIds.length > 0 ? (
              <span>
                {selectedTagIds.length} tag
                {selectedTagIds.length > 1 ? "s" : ""} selected
              </span>
            ) : (
              "Filter by tags"
            )}
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-0" align="start">
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
                        onSelect={() => handleToggle(tag)}
                        className="flex items-center gap-2"
                      >
                        <div
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded border",
                            selectedTagIdsSet.has(tag.id)
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted"
                          )}
                        >
                          {selectedTagIdsSet.has(tag.id) && (
                            <Check className="h-3 w-3" />
                          )}
                        </div>
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="flex-1">{tag.name}</span>
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
