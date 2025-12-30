/**
 * Shared echo_search tool instructions
 * Supports multiple formats for different modes
 */

export interface EchoSearchOptions {
    format?: 'markdown' | 'xml';
}

export function getEchoSearchInstructions(options: EchoSearchOptions = {}): string {
    const { format = 'markdown' } = options;

    if (format === 'xml') {
        return `<tool_usage tool="echo_search">
<summary>Intelligent code exploration sub-agent for semantic understanding.</summary>
<params>
*   query: Natural language description of what to find (required)
*   path: Starting directory to search (recommended)
*   hints: Keywords to help locate relevant code (optional)
</params>
<notes>
*   Use for understanding architecture, patterns, and how things work.
*   Best for exploring unfamiliar or complex code.
*   Prefer grep_search when you know exact identifiers.
</notes>
</tool_usage>`;
    }

    return `## echo_search
Intelligent code exploration sub-agent.

Parameters:
- query: Natural language description (required)
- path: Starting directory (recommended)
- hints: Keywords to help locate code (optional)

When to use:
- Need to understand how something works (architecture/logic)
- Exploring unfamiliar, complex code
- Looking for patterns or high-level context
- "Plan Mode" style deep dives

When NOT to use:
- Finding specific files (use list_files or grep_search)
- Checking simple file content (use read_file)
- "Basic stuff" where context is obvious
- You just need to find a definition (use grep_search)

Be specific:
- BAD: "find auth" (too vague)
- GOOD: "how is user authentication token validated"

Use grep_search instead when you know the exact identifier.`;
}