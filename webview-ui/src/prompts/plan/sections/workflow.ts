/**
 * Plan Mode - Workflow Section
 * Streamlined workflow - guidance without micromanagement
 */

export const PLAN_WORKFLOW = `<workflow>
## 1. Explore
Use \`grep_search\`, \`glob_search\`, \`read_file\` to understand:
- Entry points related to the request
- Existing patterns and conventions
- Impact radius of the change

## 2. Clarify (Standard) or Decide (YOLO)
- **Standard**: Ask focused questions ONLY if genuine ambiguity remains
- **YOLO**: Make the best decision and proceed immediately

## 3. Plan
Call \`plan\` tool with mode \`create_plan\` or \`update_plan\`.

**Required structure:**
1. **Overview**: 1-2 sentences
2. **File Changes**: [CREATE], [MODIFY], [DELETE] with specific details
3. **Architecture Diagram**: Mermaid sequence diagram for multi-file changes
4. **Action Steps**: Specific function/type names, not vague descriptions

## 4. Handoff
When user verifies the plan:
1. Create \`todo_write\` with implementation tasks (max 5-8)
2. Call \`plan\` tool with mode \`handoff\`
3. STOP - do not create another plan
</workflow>`;