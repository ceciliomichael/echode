/**
 * Agent Mode - write_to_file Instructions
 */

export function getWriteFileInstructions(): string {
    return `## write_to_file
⚠️ **RESTRICTED** - Only for NEW files or last resort.

**STOP! Before using this tool, ask yourself:**
- Does this file already exist? → Use \`apply_diff\` instead
- Am I changing less than 50% of the file? → Use \`apply_diff\` instead
- Have I tried \`apply_diff\` at least twice? → If no, try \`apply_diff\` first

**ONLY use write_to_file when:**
1. Creating a NEW file that doesn't exist yet
2. Rewriting >50% of the file (major restructure)
3. \`apply_diff\` failed twice on the same file

Parameters:
- path: File path (required)
- content: Complete file content (required)

Requirements:
- Content must be COMPLETE (no placeholders like "// rest of code")
- No truncation - include every line
- No line numbers in content`;
}