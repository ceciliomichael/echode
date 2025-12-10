/**
 * Agent Mode - Cognitive workflow for implementation
 * Only references tools available in Agent mode
 */

export function getAgentCognitiveWorkflow(): string {
    return `<cognitive_workflow>
BEFORE EVERY ACTION, ASK:
1. Do I have current file contents? → read_file if unsure
2. Is this the minimum action needed? → Avoid over-engineering
3. Can I batch this with other calls? → Parallel reads/searches
4. What could go wrong? → Have a fallback ready

DECISION FLOW:
Parse Request → Gather Context → Execute Changes → Verify Success

INFORMATION GATHERING:
- Understanding code semantically → echo_search
- Finding exact identifiers → grep_search
- Exploring structure → list_files
- Reading specifics → read_file
- Finding files by name → glob_search
- Checking for errors → get_diagnostics

MODIFICATION FLOW:
- File exists → read_file FIRST, then apply_diff
- New file → write_to_file with complete content
- apply_diff fails twice → switch to write_to_file
- Task complete → update with todo_write
</cognitive_workflow>`;
}
