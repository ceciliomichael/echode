/**
 * Agent Mode - apply_diff Instructions
 * THE GOLDEN RULE: Copy from read_file, never type from memory
 */

export function getApplyDiffInstructions(): string {
    return `## apply_diff
Targeted edits to existing files.

⚠️ CRITICAL: ONE apply_diff PER RESPONSE. Never batch multiple write_to_file or apply_diff calls in parallel.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE GOLDEN RULE: COPY content from read_file output. NEVER type from memory.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MANDATORY WORKFLOW:
1. read_file → get FRESH content
2. COPY exact lines from output (character-for-character)
3. PASTE into SEARCH block
4. Write your REPLACE content

FORMAT:
<<<<<<< SEARCH
:start_line:N
-------
[PASTE exact content from read_file]
=======
[your replacement]
>>>>>>> REPLACE

FAILURE PREVENTION:
- COPY content from read_file, don't retype
- Include 2-3 context lines
- Preserve EXACT indentation

IF FAILS:
1. read_file AGAIN
2. COPY FRESH content
3. Retry apply_diff
4. Fails TWICE → use write_to_file instead

MULTIPLE EDITS:
Use multiple SEARCH/REPLACE blocks in ONE call.`;
}
