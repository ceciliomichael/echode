/**
 * General Mode - apply_diff Instructions
 * Same as Agent - copy don't type
 */

export function getApplyDiffInstructions(): string {
    return `## apply_diff
Targeted edits to existing files.

⚠️ CRITICAL: ONE apply_diff PER RESPONSE. Never batch multiple write_to_file or apply_diff calls in parallel.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE GOLDEN RULE: COPY content from read_file output. NEVER type from memory.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WORKFLOW:
1. read_file → get FRESH content
2. COPY exact lines from output
3. PASTE into SEARCH block
4. Write your REPLACE content

Use apply_diff in General mode only for small, localized edits in a single file. For larger changes or multi-file refactors, suggest using Plan/Agent mode instead.

FORMAT:
<<<<<<< SEARCH
:start_line:N
-------
[PASTE exact content from read_file]
=======
[your replacement]
>>>>>>> REPLACE

IF FAILS:
1. read_file AGAIN
2. COPY FRESH content
3. Retry
4. Fails TWICE → use write_to_file`;
}
