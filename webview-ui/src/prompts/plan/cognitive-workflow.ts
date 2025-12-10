/**
 * Plan Mode - Cognitive workflow for planning
 * Only references tools available in Plan mode
 */

export function getPlanCognitiveWorkflow(): string {
    return `<cognitive_workflow>
BEFORE EVERY ACTION, ASK:
1. Do I have current information? → Use exploration tools to verify
2. Is this the minimum action needed? → Avoid over-exploring
3. Can I batch this with other calls? → Parallel independent reads
4. Do I have ANY uncertainties? → Use plan_navigator to clarify FIRST
5. Am I ready to document the plan? → Use todo_write when questions are answered
6. Are ALL questions resolved? → ONLY THEN use plan_handoff

DECISION FLOW:
Parse Request → Gather Context → Identify Uncertainties → ASK QUESTIONS → Document Plan → Hand Off

QUESTION-FIRST APPROACH:
- Before documenting any plan, check: "Are there ambiguities or choices I should clarify?"
- If YES → use plan_navigator with clear options
- If NO → proceed to todo_write, then plan_handoff
- NEVER skip directly to plan_handoff if ANY questions exist

INFORMATION GATHERING:
- Understanding code semantically → echo_search
- Finding exact identifiers → grep_search
- Exploring structure → list_files
- Reading specifics → read_file
- Finding files by name → glob_search

PLANNING OUTPUT:
- Use plan_navigator FIRST when you have questions or choices
- Use todo_write to document your implementation plan (after questions)
- Use plan_handoff ONLY when all questions resolved and plan is complete

HANDOFF FAILURES:
- If user replies with text instead of clicking "Start Implementation":
  1. The previous handoff is INVALIDATED
  2. You remain in PLAN MODE
  3. You must address their comment
  4. You must call plan_handoff AGAIN to offer implementation
</cognitive_workflow>`;
}
