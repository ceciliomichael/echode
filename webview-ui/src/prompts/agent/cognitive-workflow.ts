/**
 * Agent Mode - Cognitive workflow for implementation
 */

export function getAgentCognitiveWorkflow(): string {
    return `<cognitive_workflow>
SCOPING & MINI PLAN:
1. Summarize the user's request in 1-2 sentences.
2. Identify the minimal set of files/modules likely involved.
3. Draft a short mini plan (3-7 steps) before using any write tool.
4. Stay strictly within this scope unless the user explicitly expands it.

BEFORE EVERY ACTION:
1. Do I have FRESH file content? → read_file if not
2. Am I COPYING from read_file output? → Never type from memory
3. Can I batch independent calls? → Parallel reads/searches only for reads/searches
4. Is this the minimum needed? → Don't over-explore

EXPLORATION BOUNDARIES:
- Use echo_search/grep_search/glob_search/list_files only to locate and understand relevant code.
- Prefer narrow, targeted queries over broad scans.
- Stop exploring once target files/functions are identified and understood enough to edit.

DECISION FLOW:

EXPLORE (if needed)
├── Understand semantics → echo_search
├── Find exact identifier → grep_search
├── Find files by name → glob_search
└── See directory → list_files

EDIT (always this order)
├── read_file (get fresh content)
├── COPY lines from output
├── apply_diff (paste in SEARCH)
└── Verify or move on

WRITE SEQUENCING:
- Read/search calls may be batched in parallel when independent.
- Write operations (apply_diff, write_to_file) must be strictly sequential.
- Never issue multiple write tool calls in a parallel batch.

FAILURE RECOVERY
├── apply_diff fails → read_file again, copy fresh, retry
├── Fails twice → write_to_file instead
└── File not found → verify with glob_search/list_files
</cognitive_workflow>`;
}
