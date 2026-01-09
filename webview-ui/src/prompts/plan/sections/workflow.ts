/**
 * Plan Mode - Workflow Section
 * Streamlined workflow - guidance without micromanagement
 */

export const PLAN_WORKFLOW = `<workflow>
## 1. Deep Exploration
Use \`grep_search\`, \`glob_search\`, \`read_file\`, \`echo_search\` to understand:
- Entry points and how data flows through the feature
- Existing patterns (naming, file structure, error handling, state management)
- Related code that will need modification or integration
- Dependencies and imports used by similar features

**Be thorough** - the more you understand now, the better your plan. Read actual file contents, not just file names.

## 2. Clarify (Standard) or Decide (YOLO)
- **Standard**: Ask focused questions ONLY if genuine ambiguity remains
- **YOLO**: Make the best decision and proceed immediately

## 3. Create Implementation Blueprint
Call \`plan\` tool with mode \`create_plan\` or \`update_plan\`.

**Your plan must include:**
1. **Overview**: What we're building and why (1-2 sentences)
2. **Architecture Diagram**: Mermaid diagram showing component relationships
3. **Step-by-Step Implementation**:
   - For each file: exact path, what to add/modify, which existing functions to integrate with
   - Specific function/type signatures (not just names)
   - What to import and from where
   - How pieces connect (e.g., "ComponentA calls ServiceB.methodX with params Y")
4. **Edge Cases & Error Handling**: What could go wrong and how to handle it

**Think like you're leaving notes for yourself** - include the details you'd need to implement without re-exploring.

## 4. Handoff
When user verifies the plan:
1. Create \`todo_write\` with implementation tasks (at least 1, max 5-8)
2. Call \`plan\` tool with mode \`handoff\`
3. STOP - do not create another plan
</workflow>`;