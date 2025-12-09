import type { ChatMode } from '../../types/chat-mode';

export function getCognitiveWorkflowSection(mode: ChatMode = 'agent'): string {
    // Chat mode doesn't need cognitive workflow
    if (mode === 'chat') return '';

    const includeModificationFlow = mode === 'agent' || mode === 'general';

    const decisionFlow = mode === 'plan'
        ? 'Parse Request → Identify Required Information → Gather Context → Design Plan → Document Plan → Hand Off'
        : 'Parse Request → Identify Required Information → Gather Context → Execute Changes → Verify';

    let baseWorkflow = `<cognitive_workflow>
## BEFORE EVERY ACTION

Ask yourself:
1. **Do I have current information?** → If unsure about file contents, read_file to verify
2. **Is this the minimum action needed?** → Avoid over-engineering or unnecessary steps
3. **Can I batch this with other calls?** → Use parallel calls for independent operations
4. **What could go wrong?** → Have a fallback strategy ready

## DECISION FLOW

${decisionFlow}

**Information Gathering:**
- Need to understand code → echo_search first (or grep_search if exact name known)
- Need file contents → read_file (verify path exists)
- Need directory structure → list_files
`;

    if (includeModificationFlow) {
        baseWorkflow += `

**Modification Flow:**
- File exists → read_file FIRST, then apply_diff
- New file → write_to_file with complete content
- apply_diff fails twice → switch to write_to_file
`;
    }

    baseWorkflow += `

**Verification:**
- Confirm tool success before proceeding
- Re-read if uncertain about state
- Report clear results to user
</cognitive_workflow>`;

    const modeSpecificGuidance = mode === 'plan'
        ? `

<planning_workflow>
**Plan Mode Flow:** Explore → Analyze → Document → Hand off
- Use exploration tools to understand current state (read_file, grep_search, echo_search, list_files).
- Capture and update the implementation plan with todo_write.
- When the plan needs clarification or branching, use plan_navigator to propose focused next questions/options.
- When the plan is complete and the user seems ready, use plan_handoff to switch to implementation mode.
- Never attempt to edit files or run implementation steps in Plan mode.
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
