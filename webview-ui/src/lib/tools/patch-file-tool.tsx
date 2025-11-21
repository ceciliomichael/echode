import { FileDiff } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension } from '../tool-utils';
import { DiffViewer } from '../../components/ui/diff-viewer';

async function executePatchFile(
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolExecutionResult> {
  return executeToolViaExtension('patch_file', parameters, signal);
}

registerToolPlugin({
  metadata: {
    id: 'patch_file',
    name: 'Patch File',
    description: 'Apply unified diff patches to files - PRIMARY EDITING TOOL',
    aiDescription: `PRIMARY EDITING TOOL - Use this for ALL file modifications. **Bulletproof multi-hunk patching with CRLF-safe matching.**

**MANDATORY WORKFLOW (STRICT SEQUENCE):**
1. Call read_file to get current content
2. IMMEDIATELY build patch from that EXACT content (use line numbers from read result)
3. Call patch_file with the patch you JUST generated
4. If patch fails → GOTO step 1 (read again, generate NEW patch)

**NEVER SKIP STEPS. NEVER REUSE OLD PATCHES.**

**Patch Format (Unified Diff):**
- Header: --- a/path\\n+++ b/path
- Hunk header: @@ -oldStart,oldCount +newStart,newCount @@
- Lines: ' ' = unchanged (context), '-' = remove, '+' = add
- REQUIRE ≥3 lines of unchanged context BEFORE and AFTER changes
- Hunks MUST be sorted by line number (ascending)

**Robustness features:**
- CRLF/LF line-ending safe (Windows-compatible)
- Multi-hunk offset tracking (later hunks auto-adjust)
- Validates hunks before applying
- Structured error codes for recovery

**Error codes and recovery:**
- **CONTEXT_MISMATCH**: File changed since read_file → read_file again, generate NEW patch
- **LINE_OUT_OF_RANGE**: Target line doesn't exist → read_file again, use correct line numbers
- **PATCH_FORMAT_INVALID**: Malformed patch → regenerate with proper unified diff format
- **WHITESPACE_MISMATCH**: Indentation differs → match whitespace exactly from read_file

**Example:**
<function_call>
<tool_name>patch_file</tool_name>
<path>src/app.ts</path>
<patch>--- a/src/app.ts
+++ b/src/app.ts
@@ -10,7 +10,8 @@ function example() {
   // context line
   const x = 1;
-  const y = 2;
+  const y = 3;
+  const z = 4;
   return x + y;
   // context line
 }</patch>
</function_call>

**CRITICAL RULES:**
- ✅ read_file → IMMEDIATELY build patch → patch_file (same sequence, no delay)
- ❌ NEVER guess line numbers - use read_file output
- ✅ Include 3+ context lines for safety
- ❌ NEVER reuse patches from earlier in conversation
- ❌ NEVER retry failed patch with same content - read_file again and generate NEW patch
- ✅ Each patch must be built from content you JUST read
- ✅ Multi-hunk edits work correctly (offsets auto-tracked)`,
    icon: FileDiff,
    usage: 'Apply unified diff patches - PRIMARY EDITING TOOL',
    formatExample: '<function_call>\n<tool_name>patch_file</tool_name>\n<path>src/app.ts</path>\n<patch>--- a/src/app.ts\n+++ b/src/app.ts\n@@ -10,7 +10,8 @@\n   const x = 1;\n-  const y = 2;\n+  const y = 3;\n+  const z = 4;\n   return x + y;\n }</patch>\n</function_call>',
  },
  handler: {
    execute: executePatchFile,
  },
  renderer: (data: unknown) => {
    if (typeof data === 'object' && data !== null) {
      const result = data as {
        path: string;
        hunksApplied: number;
        linesAdded: number;
        linesRemoved: number;
        originalContent: string;
        newContent: string;
        truncated?: boolean;
      };

      return (
        <div className="space-y-2">
          <div className="text-xs opacity-70">
            <span className="font-semibold">Patch applied:</span> {result.hunksApplied} {result.hunksApplied === 1 ? 'hunk' : 'hunks'}, 
            <span style={{ color: 'var(--vscode-gitDecoration-addedResourceForeground)' }}> +{result.linesAdded}</span>
            <span style={{ color: 'var(--vscode-gitDecoration-deletedResourceForeground)' }}> -{result.linesRemoved}</span>
          </div>
          <div className="rounded-md overflow-hidden border border-[var(--vscode-input-border)]">
            <DiffViewer
              oldContent={result.originalContent}
              newContent={result.newContent}
              fileName={result.path}
              viewOnly={false}
            />
          </div>
          {result.truncated && (
            <div className="text-xs opacity-50">
              (Content truncated for display)
            </div>
          )}
        </div>
      );
    }
    return <div className="text-xs opacity-70">Patch applied successfully</div>;
  },
});
