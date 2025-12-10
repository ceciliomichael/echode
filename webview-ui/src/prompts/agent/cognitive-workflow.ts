/**
 * Agent Mode - Cognitive workflow for implementation
 */

export function getAgentCognitiveWorkflow(): string {
    return `<cognitive_workflow>
BEFORE EVERY ACTION:
1. Do I have FRESH file content? → read_file if not
2. Am I COPYING from read_file output? → Never type from memory
3. Can I batch independent calls? → Parallel reads/searches
4. Is this the minimum needed? → Don't over-explore

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

FAILURE RECOVERY
├── apply_diff fails → read_file again, copy fresh, retry
├── Fails twice → write_to_file instead
└── File not found → verify with glob_search/list_files
</cognitive_workflow>`;
}
