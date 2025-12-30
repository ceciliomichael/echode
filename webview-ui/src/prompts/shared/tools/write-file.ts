/**
 * Shared write_to_file tool instructions
 * Restricted to NEW files or complete rewrites when necessary
 */

export function getWriteFileInstructions(): string {
    return `## write_to_file
**RESTRICTED** - Only for NEW files or complete rewrites when necessary.

**Before using this tool, consider:**
- Does this file already exist? Use \`apply_diff\` instead for efficiency
- Can this change be done incrementally? Use \`apply_diff\` instead

**Use write_to_file ONLY when:**
1. Creating a NEW file that does not exist yet
2. A complete rewrite is genuinely required (use your judgment based on the circumstances)

For all other modifications to existing files, use \`apply_diff\` as it is more efficient and preserves unchanged content.

Parameters:
- path: File path (required)
- content: Complete file content (required)

Requirements:
- Content must be COMPLETE (no placeholders like "// rest of code")
- No truncation - include every line
- No line numbers in content

### EXAMPLE - Creating a new file
<function_calls>
<invoke name="write_to_file">
    <parameter name="path">src/utils/helpers.ts</parameter>
    <parameter name="content">
export function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

export function capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
    </parameter>
</invoke>
</function_calls>

### EXAMPLE - Complete rewrite (when circumstances require it)
<function_calls>
<invoke name="write_to_file">
    <parameter name="path">src/config.ts</parameter>
    <parameter name="content">
// Completely restructured configuration
export const config = {
    api: {
        baseUrl: 'https://api.example.com',
        timeout: 5000,
    },
    features: {
        darkMode: true,
        notifications: true,
    },
};
    </parameter>
</invoke>
</function_calls>`;
}