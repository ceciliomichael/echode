import type { ChatMode } from '../../types/chat-mode';

export function getCognitiveWorkflowSection(mode: ChatMode = 'agent'): string {
    // Chat mode doesn't need cognitive workflow
    if (mode === 'chat') return '';

    const baseWorkflow = `<cognitive_workflow>
## BEFORE EVERY ACTION

Ask yourself:
1. **Do I have current information?** → If unsure about file contents, read_file to verify
2. **Is this the minimum action needed?** → Avoid over-engineering or unnecessary steps
3. **Can I batch this with other calls?** → Use parallel calls for independent operations
4. **What could go wrong?** → Have a fallback strategy ready

## DECISION FLOW

Parse Request → Identify Required Information → Gather Context → Execute Changes → Verify

**Information Gathering:**
- Need to understand code → echo_search first (or grep_search if exact name known)
- Need file contents → read_file (verify path exists)
- Need directory structure → list_files

**Modification Flow:**
- File exists → read_file FIRST, then apply_diff
- New file → write_to_file with complete content
- apply_diff fails twice → switch to write_to_file

**Verification:**
- Confirm tool success before proceeding
- Re-read if uncertain about state
- Report clear results to user
</cognitive_workflow>`;

    const modeSpecificGuidance = mode === 'plan'
        ? `

<planning_workflow>
**Plan Mode Flow:** Explore → Analyze → Document → Hand off
- Use exploration tools to understand current state
- Create clear implementation plans with todo_write
- Hand off to Agent mode when ready to implement
</planning_workflow>`
        : mode === 'ask'
            ? `

<qa_workflow>
**Q&A Mode Flow:** Understand Question → Gather Context → Answer Clearly
- Use tools only when needed to answer accurately
- Keep responses focused on the question
- Cite specific files/lines when referencing code
</qa_workflow>`
            : '';

    return baseWorkflow + modeSpecificGuidance;
}
