import { FileCode } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension } from '../tool-utils';

/**
 * Apply Diff Tool - SEARCH/REPLACE code edits with fuzzy matching
 */
async function executeApplyDiff(
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolExecutionResult> {
  return executeToolViaExtension('apply_diff', parameters, signal);
}

registerToolPlugin({
  metadata: {
    id: 'apply_diff',
    name: 'Apply Diff',
    description: 'Apply multiple SEARCH/REPLACE code edits in a file with fuzzy matching',
    aiDescription: `ROBUST MULTI-EDIT TOOL - Apply multiple precise SEARCH/REPLACE blocks in a single file using line hints and fuzzy matching.

🚨 CRITICAL: ALWAYS call read_file BEFORE using apply_diff. NEVER retry failed diffs with the same search text - read the file again first!

**When to use:**
- Making multiple related changes in ONE file (more efficient than multiple edit_file calls)
- You have line numbers from read_file and want to use them as hints
- Content might have minor whitespace changes (fuzzy matching handles it)
- Applying structured diffs with clear before/after sections

**When NOT to use:**
- Simple single find/replace → use edit_file instead
- Multiple files → make separate calls per file
- You don't know the exact content → call read_file first

**MANDATORY WORKFLOW:**
1. Call read_file to see current file with line numbers (e.g., "1: const x = 1;")
2. Note the line number where your change starts (use this as :start_line:)
3. Copy the EXACT text you want to replace (including whitespace)
4. Construct SEARCH/REPLACE blocks with the replacement text
5. Call apply_diff with all blocks in one call

**Block format (CRITICAL - must be exact):**
\`\`\`
<<<<<<< SEARCH
:start_line:10
-------
[exact content to find - copy from read_file output]
=======
[new content to replace with]
>>>>>>> REPLACE
\`\`\`

**Format rules:**
- Exactly 7 '<' for SEARCH, 7 '>' for REPLACE
- :start_line: is OPTIONAL but HIGHLY RECOMMENDED for accuracy
  - Use the line number from read_file where your search text starts
  - Tool searches ±40 lines around this hint for efficiency
- '-------' separator (7 dashes) after :start_line: or SEARCH
- '=======' separator (7 equals) between search and replace
- Empty lines, whitespace, and indentation in search MUST match file exactly
- Multiple blocks in ONE call - just add more SEARCH/REPLACE sections

**Fuzzy matching:**
- 85% similarity threshold by default (handles minor whitespace changes)
- Tries exact match first, falls back to fuzzy if needed
- Returns similarity score if fuzzy match was used

**Example 1: Single change with line hint**
\`\`\`
<function_call>
<tool_name>apply_diff</tool_name>
<path>src/app.ts</path>
<diff>
<<<<<<< SEARCH
:start_line:5
-------
const count = 0;
=======
const count = 10;
>>>>>>> REPLACE
</diff>
</function_call>
\`\`\`

**Example 2: Multiple changes in one file**
\`\`\`
<function_call>
<tool_name>apply_diff</tool_name>
<path>src/component.tsx</path>
<diff>
<<<<<<< SEARCH
:start_line:10
-------
function MyComponent() {
  return <div>Hello</div>;
}
=======
function MyComponent() {
  return (
    <div>
      <h1>Hello</h1>
    </div>
  );
}
>>>>>>> REPLACE

<<<<<<< SEARCH
:start_line:25
-------
export default MyComponent;
=======
export { MyComponent };
export default MyComponent;
>>>>>>> REPLACE
</diff>
</function_call>
\`\`\`

**Example 3: Multi-line change without line hint**
\`\`\`
<function_call>
<tool_name>apply_diff</tool_name>
<path>src/utils.ts</path>
<diff>
<<<<<<< SEARCH
-------
export function add(a: number, b: number): number {
  return a + b;
}
=======
export function add(a: number, b: number): number {
  // Added input validation
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new Error('Both arguments must be numbers');
  }
  return a + b;
}
>>>>>>> REPLACE
</diff>
</function_call>
\`\`\`

**Common errors and fixes:**

**DIFF_FORMAT_INVALID** - Malformed block:
- Check you have exactly 7 '<' and 7 '>'
- Verify '-------' and '=======' separators are present
- Make sure :start_line: is on its own line if present
- Don't put extra whitespace in markers

**APPLY_DIFF_FAILED: Search content not found**:
⚠️ CRITICAL: DO NOT RETRY with the same search text!
- The error message shows what your search text was and what the actual file content is
- They don't match - your search text is wrong or outdated
- REQUIRED next step: Call read_file to see CURRENT content with line numbers
- Copy EXACTLY what read_file shows (character-for-character including whitespace)
- Use the line numbers from read_file for :start_line: hints

**Partial application warning**:
⚠️ IMPORTANT: The file WAS modified by successful blocks
- Some blocks applied successfully, some failed
- The error shows which blocks succeeded (✅) and which failed (❌)
- The file now contains changes from successful blocks
- REQUIRED next steps:
  1. Call read_file to see the CURRENT state (after successful changes)
  2. Create NEW apply_diff with ONLY the failed blocks
  3. Use updated search text from the current file state
  4. DO NOT include successful blocks again - they already worked!

**Best practices:**
1. ALWAYS call read_file first to get line numbers
2. Use :start_line: hints for better performance and accuracy
3. Make multiple related changes in ONE apply_diff call
4. Copy exact whitespace/indentation from read_file
5. For large functions, include a few context lines before/after
6. If a block fails, the file is partially modified - other blocks still applied

**Advantages over edit_file:**
- Multiple changes in one call (more efficient)
- Line number hints speed up search
- Fuzzy matching handles minor variations
- Clear before/after structure
- Better for structured refactoring

**Advantages over patch_file:**
- More forgiving (fuzzy matching)
- Easier to construct (no unified diff format)
- Better error messages
- Doesn't require exact line numbers for all changes`,
    icon: FileCode,
    usage: 'Apply SEARCH/REPLACE edits with fuzzy matching',
    formatExample: `<function_call>
<tool_name>apply_diff</tool_name>
<path>src/app.ts</path>
<diff>
<<<<<<< SEARCH
:start_line:10
-------
const x = 1;
=======
const x = 2;
>>>>>>> REPLACE
</diff>
</function_call>`,
  },
  handler: {
    execute: executeApplyDiff,
  },
  // No custom renderer - diff viewer in tool-block.tsx handles visualization
  renderer: undefined,
});
