import { FilePenLine } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension } from '../tool-utils';

/**
 * Multi Edit Tool - Apply multiple find-replace edits to a single file atomically
 */
async function executeMultiEdit(
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolExecutionResult> {
  return executeToolViaExtension('multi_edit', parameters, signal);
}

registerToolPlugin({
  metadata: {
    id: 'multi_edit',
    name: 'Multi Edit',
    description: 'Apply multiple find-replace edits to a single file atomically',
    aiDescription: `Batch version of edit_file - apply multiple non-overlapping edits to a single file in one atomic operation.

**When to use:**
- Multiple non-adjacent changes in the same file
- Batch of related edits (e.g., rename multiple variables, add multiple imports)
- Want all-or-nothing guarantee (all edits succeed or none are applied)

**When NOT to use:**
- Single edit → use edit_file instead (simpler)
- Edits across multiple files → use separate edit_file calls
- Overlapping edits (modifying same region) → use single edit_file with combined change

**MANDATORY WORKFLOW:**
1. Call read_file to get current file content (with line numbers)
2. Identify all changes you want to make
3. Copy EXACT text for each old_string from read_file output
4. Call multi_edit with edits array
5. If error mentions "Edit N", fix that specific edit or split into separate calls

**Critical rules:**
- Each old_string must match EXACTLY (whitespace, indentation, line breaks)
- Each old_string must appear ONCE in the file (checked sequentially)
- Edits apply in array order (later edits see results of earlier ones)
- ATOMIC: if any edit fails, NO changes are written to file
- Do NOT overlap edits (same region modified twice)

**Parameters:**
- path: File path to edit
- edits: Array of edit objects:
  - id (optional): Label for debugging
  - old_string (required): Exact text to replace
  - new_string (required): Replacement text

**Error handling:**

**MULTI_EDIT_FAILED: Edit N: STRING_NOT_FOUND**
- old_string not found (whitespace differs or file changed)
- Fix: Call read_file again, copy exact text for that edit

**MULTI_EDIT_FAILED: Edit N: STRING_AMBIGUOUS**
- old_string appears multiple times
- Fix: Add more context (surrounding lines) to make old_string unique

**Example 1: Multiple imports**
<function_call>
<tool_name>read_file</tool_name>
<path>src/app.tsx</path>
</function_call>

Result shows:
\`\`\`
1: import React from 'react';
2: 
3: export function App() {
\`\`\`

<function_call>
<tool_name>multi_edit</tool_name>
<path>src/app.tsx</path>
<edits>[
  {
    "id": "add-button-import",
    "old_string": "import React from 'react';\\n",
    "new_string": "import React from 'react';\\nimport { Button } from './components/button';\\n"
  },
  {
    "id": "add-icon-import",
    "old_string": "import React from 'react';\\nimport { Button } from './components/button';\\n",
    "new_string": "import React from 'react';\\nimport { Button } from './components/button';\\nimport { Icon } from './components/icon';\\n"
  }
]</edits>
</function_call>

**Example 2: Rename multiple variables**
<function_call>
<tool_name>read_file</tool_name>
<path>src/counter.ts</path>
</function_call>

Result shows:
\`\`\`
5:   const count = 0;
6:   const setCount = useState();
10:   return count + 1;
\`\`\`

<function_call>
<tool_name>multi_edit</tool_name>
<path>src/counter.ts</path>
<edits>[
  {
    "id": "rename-declaration",
    "old_string": "  const count = 0;\\n  const setCount = useState();",
    "new_string": "  const value = 0;\\n  const setValue = useState();"
  },
  {
    "id": "rename-usage",
    "old_string": "  return count + 1;",
    "new_string": "  return value + 1;"
  }
]</edits>
</function_call>

**Critical: Copy exact whitespace**
If read_file shows \`"  const x = 1;"\` (2 spaces), your old_string must have exactly 2 spaces.

**Critical: Sequential application**
Edits apply in order. Edit 2 sees the result of Edit 1. Plan accordingly.

**Critical: Non-overlapping**
Do NOT have two edits that modify the same text region. Use single edit_file instead.`,
    icon: FilePenLine,
    usage: 'Apply multiple find-replace edits to a single file atomically',
    formatExample: '<function_call>\\n<tool_name>multi_edit</tool_name>\\n<path>src/app.ts</path>\\n<edits>[{"old_string": "const x = 1;", "new_string": "const x = 2;"}]</edits>\\n</function_call>',
  },
  handler: {
    execute: executeMultiEdit,
  },
  // No renderer needed - diff viewer in tool-block.tsx handles visualization
  renderer: undefined,
});
