
// Regex for context-menu-inserted mentions: @[label](path) or just @[label]
// This format distinguishes selected mentions from manually typed @text
export const mentionRegex = /@\[([^\]]+)\](?:\(([^)]+)\))?/g;
export const mentionRegexGlobal = /(@\[[^\]]+\](?:\([^)]+\))?)/g;
export const slashCommandRegex = /\/\[([^\]]+)\]/g;

export interface SearchResult {
    path: string;
    type: "file" | "folder" | "workflow";
    label?: string;
    description?: string;
}

export const ContextMenuOptionType = {
    File: "file",
    Folder: "folder",
    Problems: "problems",
    Workflow: "workflow",
    NoResults: "noResults",
    SectionHeader: "sectionHeader",
} as const;

export type ContextMenuOptionType = typeof ContextMenuOptionType[keyof typeof ContextMenuOptionType];

// Trigger types for context menu
export type ContextMenuTrigger = '@' | '/' | null;

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
    label?: string,
    triggerChar: '@' | '/' = '@'
): { newValue: string; mentionIndex: number; insertedLabel: string } {
    const beforeCursor = text.slice(0, position);
    const afterCursor = text.slice(position);

    // Find the trigger character position
    const triggerIndex = beforeCursor.lastIndexOf(triggerChar);

    // Extract filename/folder name for label if not provided
    const effectiveLabel = label || value.split('/').pop() || value;

    // We strictly insert just the label part: @[label]
    // The storing of the path mapping is handled by the caller
    const mentionText = `@[${effectiveLabel}]`;

    let newValue: string;
    let mentionIndex: number;

    if (triggerIndex !== -1) {
        const beforeMention = text.slice(0, triggerIndex);
        // Remove partial mention text after trigger if present
        const afterCursorContent = afterCursor.replace(/^[^\s]*/, "");
        newValue = beforeMention + mentionText + " " + afterCursorContent;
        mentionIndex = triggerIndex;
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

    // Handle Workflow selection - show workflow search results
    if (selectedType === ContextMenuOptionType.Workflow) {
        const workflowResults = dynamicSearchResults
            .filter(result => result.type === "workflow")
            .map((result) => ({
                type: ContextMenuOptionType.Workflow,
                value: result.path,
                label: result.label || result.path.split('/').pop()?.replace('.md', '') || result.path,
                description: result.description || result.path
            }));

        if (workflowResults.length > 0) {
            return workflowResults;
        }

        if (!query) {
            return [{ type: ContextMenuOptionType.NoResults, label: "Type to search workflows..." }];
        }

        return [{ type: ContextMenuOptionType.NoResults, label: "No workflows found" }];
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

/**
 * Check if slash command menu should be shown
 * Only triggers when `/` is at start of line or after a space
 */
export function shouldShowSlashMenu(text: string, position: number): boolean {
    const beforeCursor = text.slice(0, position);
    
    // Find the last `/` before cursor
    const slashIndex = beforeCursor.lastIndexOf("/");
    
    if (slashIndex === -1) {
        return false;
    }
    
    // Check if `/` is at start of line or preceded by whitespace
    const charBeforeSlash = slashIndex > 0 ? beforeCursor[slashIndex - 1] : '';
    const isValidTrigger = slashIndex === 0 || charBeforeSlash === ' ' || charBeforeSlash === '\n';
    
    if (!isValidTrigger) {
        return false;
    }
    
    const textAfterSlash = beforeCursor.slice(slashIndex + 1);
    // If there's a space after the command text, menu should close
    if (textAfterSlash.includes(" ")) {
        return false;
    }
    
    return true;
}

/**
 * Get the current trigger type and position
 * Returns which menu should be shown (@ or /) and the trigger position
 */
export function getContextMenuTrigger(text: string, position: number): { 
    trigger: ContextMenuTrigger; 
    triggerIndex: number;
    query: string;
} {
    const beforeCursor = text.slice(0, position);
    
    // Check for slash command first (higher priority if at start of input)
    const slashIndex = beforeCursor.lastIndexOf("/");
    if (slashIndex !== -1) {
        const charBeforeSlash = slashIndex > 0 ? beforeCursor[slashIndex - 1] : '';
        const isValidSlashTrigger = slashIndex === 0 || charBeforeSlash === ' ' || charBeforeSlash === '\n';
        const textAfterSlash = beforeCursor.slice(slashIndex + 1);
        
        if (isValidSlashTrigger && !textAfterSlash.includes(" ")) {
            return {
                trigger: '/',
                triggerIndex: slashIndex,
                query: textAfterSlash
            };
        }
    }
    
    // Check for @ mention
    const atIndex = beforeCursor.lastIndexOf("@");
    if (atIndex !== -1) {
        const textAfterAt = beforeCursor.slice(atIndex + 1);
        if (!textAfterAt.includes(" ")) {
            return {
                trigger: '@',
                triggerIndex: atIndex,
                query: textAfterAt
            };
        }
    }
    
    return { trigger: null, triggerIndex: -1, query: '' };
}

/**
 * Insert a slash command into the text
 * Replaces the partial command with the full command name
 */
export function insertSlashCommand(
    text: string,
    position: number,
    commandName: string
): { newValue: string; newCursorPos: number } {
    const beforeCursor = text.slice(0, position);
    const afterCursor = text.slice(position);
    
    const slashIndex = beforeCursor.lastIndexOf("/");
    
    if (slashIndex === -1) {
        // No slash found, just insert at cursor
        const newValue = beforeCursor + `/[${commandName}] ` + afterCursor;
        return { newValue, newCursorPos: position + commandName.length + 4 }; // +4 for / [ ] space
    }
    
    // Replace from slash to cursor with the full command
    const beforeSlash = text.slice(0, slashIndex);
    const afterCursorContent = afterCursor.replace(/^[^\s]*/, ""); // Remove any partial text
    const newValue = beforeSlash + `/[${commandName}] ` + afterCursorContent;
    const newCursorPos = slashIndex + commandName.length + 4; // +4 for / [ ] space
    
    return { newValue, newCursorPos };
}
