
// Regex for context-menu-inserted mentions: @[label](path) or just @[label]
// This format distinguishes selected mentions from manually typed @text
export const mentionRegex = /@\[([^\]]+)\](?:\(([^)]+)\))?/g;
export const mentionRegexGlobal = /(@\[[^\]]+\](?:\([^)]+\))?)/g;

export interface SearchResult {
    path: string;
    type: "file" | "folder";
    label?: string;
}

export const ContextMenuOptionType = {
    File: "file",
    Folder: "folder",
    Problems: "problems",
    NoResults: "noResults",
    SectionHeader: "sectionHeader",
} as const;

export type ContextMenuOptionType = typeof ContextMenuOptionType[keyof typeof ContextMenuOptionType];

export interface ContextMenuQueryItem {
    type: ContextMenuOptionType;
    value?: string;
    label?: string;
    description?: string;
    icon?: string;
}

export function insertMention(
    text: string,
    position: number,
    value: string,
    label?: string
): { newValue: string; mentionIndex: number; insertedLabel: string } {
    const beforeCursor = text.slice(0, position);
    const afterCursor = text.slice(position);

    const lastAtIndex = beforeCursor.lastIndexOf("@");

    // Extract filename/folder name for label if not provided
    const effectiveLabel = label || value.split('/').pop() || value;

    // We strictly insert just the label part: @[label]
    // The storing of the path mapping is handled by the caller
    const mentionText = `@[${effectiveLabel}]`;

    let newValue: string;
    let mentionIndex: number;

    if (lastAtIndex !== -1) {
        const beforeMention = text.slice(0, lastAtIndex);
        // Remove partial mention text after @ if present
        const afterCursorContent = afterCursor.replace(/^[^\s]*/, "");
        newValue = beforeMention + mentionText + " " + afterCursorContent;
        mentionIndex = lastAtIndex;
    } else {
        newValue = beforeCursor + mentionText + " " + afterCursor;
        mentionIndex = position;
    }

    return { newValue, mentionIndex, insertedLabel: effectiveLabel };
}

export function getContextMenuOptions(
    query: string,
    selectedType: ContextMenuOptionType | null,
    dynamicSearchResults: SearchResult[] = []
): ContextMenuQueryItem[] {
    // If no category selected, show the category options
    if (selectedType === null) {
        // If we have mixed results (from 'all' search), show them
        if (dynamicSearchResults.length > 0) {
            return dynamicSearchResults.map((result) => ({
                type: result.type === "folder" ? ContextMenuOptionType.Folder : ContextMenuOptionType.File,
                value: result.path,
                label: result.label || result.path.split('/').pop() || result.path,
                description: result.path
            }));
        }

        // Define base categories
        const categories: ContextMenuQueryItem[] = [
            { type: ContextMenuOptionType.File, label: "File", description: "Search for files" },
            { type: ContextMenuOptionType.Folder, label: "Folder", description: "Search for folders" },
            { type: ContextMenuOptionType.Problems, label: "Problems", description: "Current errors in open files" },
        ];

        // Filter categories based on query (e.g., @prob -> Problems)
        if (query.length > 0) {
            const lowerQuery = query.toLowerCase();
            const filtered = categories.filter(c => 
                c.label?.toLowerCase().includes(lowerQuery)
            );
            return filtered.length > 0 
                ? filtered 
                : [{ type: ContextMenuOptionType.NoResults, label: "No matching options" }];
        }

        return categories;
    }

    // Handle Problems selection - return static item immediately
    if (selectedType === ContextMenuOptionType.Problems) {
        return [
            { 
                type: ContextMenuOptionType.Problems, 
                label: "Problems", 
                value: "__problems__", 
                description: "Insert diagnostics from open files" 
            }
        ];
    }

    // Convert search results to menu items based on selected type
    const searchResultItems = dynamicSearchResults
        .filter(result => result.type === selectedType)
        .map((result) => ({
            type: selectedType === "folder" ? ContextMenuOptionType.Folder : ContextMenuOptionType.File,
            value: result.path,
            label: result.label || result.path.split('/').pop() || result.path,
            description: result.path
        }));

    // If we have search results, show them directly
    if (searchResultItems.length > 0) {
        return searchResultItems;
    }

    // If query is empty, show a hint
    if (!query) {
        const typeLabel = selectedType === "folder" ? "folders" : "files";
        return [{ type: ContextMenuOptionType.NoResults, label: `Type to search ${typeLabel}...` }];
    }

    // No results found
    const typeLabel = selectedType === "folder" ? "folders" : "files";
    return [{ type: ContextMenuOptionType.NoResults, label: `No ${typeLabel} found` }];
}

export function shouldShowContextMenu(text: string, position: number): boolean {
    const beforeCursor = text.slice(0, position);
    const atIndex = beforeCursor.lastIndexOf("@");

    if (atIndex === -1) {
        return false;
    }

    const textAfterAt = beforeCursor.slice(atIndex + 1);
    if (textAfterAt.includes(" ")) { // Simple check: if space, assume end of mention intent
        return false;
    }

    return true;
}
