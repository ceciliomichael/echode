/**
 * Shared write_to_file tool instructions
 * Restricted to NEW files or complete rewrites when necessary
 */

import { TOOL_XML_NAMESPACE } from '../../../lib/tool-xml';

export function getWriteFileInstructions(): string {
    return `## write_to_file
**RESTRICTED** - Only for NEW files or complete rewrites when necessary.

**Before using this tool, consider:**
- Does this file already exist? Use \`edit\` instead for efficiency
- Can this change be done incrementally? Use \`edit\` instead

**Use write_to_file ONLY when:**
1. Creating a NEW file that does not exist yet
2. A complete rewrite is genuinely required (use your judgment based on the circumstances)

For all other modifications to existing files, use \`edit\` as it is more efficient and preserves unchanged content.

Parameters:
- path: File path (Absolute path required)
- content: Complete file content (required)

Requirements:
- Content must be COMPLETE (no placeholders like "// rest of code")
- No truncation - include every line
- No line numbers in content

### EXAMPLE - Creating a new file
<${TOOL_XML_NAMESPACE}:function_calls>
<${TOOL_XML_NAMESPACE}:invoke name="write_to_file">
    <${TOOL_XML_NAMESPACE}:parameter name="path">src/utils/helpers.ts</${TOOL_XML_NAMESPACE}:parameter>
    <${TOOL_XML_NAMESPACE}:parameter name="content">
export function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

export function capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
    </${TOOL_XML_NAMESPACE}:parameter>
</${TOOL_XML_NAMESPACE}:invoke>
</${TOOL_XML_NAMESPACE}:function_calls>

### EXAMPLE - Complete rewrite (when circumstances require it)
<${TOOL_XML_NAMESPACE}:function_calls>
<${TOOL_XML_NAMESPACE}:invoke name="write_to_file">
    <${TOOL_XML_NAMESPACE}:parameter name="path">src/config.ts</${TOOL_XML_NAMESPACE}:parameter>
    <${TOOL_XML_NAMESPACE}:parameter name="content">
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
    </${TOOL_XML_NAMESPACE}:parameter>
</${TOOL_XML_NAMESPACE}:invoke>
</${TOOL_XML_NAMESPACE}:function_calls>`;
}