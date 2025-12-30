/**
 * Shared plan tool instructions
 * Used exclusively in Plan mode
 */

export function getPlanInstructions(): string {
    return `## plan
Interactive planning tool for structured development workflow.

Parameters:
- mode: "create_plan" | "update_plan" | "handoff" (required)

### Mode Selection Guide (CRITICAL)
**create_plan**: Use when:
- Starting a new implementation (no plan exists yet)
- User requests something NEW after a previous plan was executed (handoff completed)
- Starting fresh on a different feature or task

**update_plan**: Use ONLY when:
- User gave feedback on the CURRENT active plan (before clicking "Verify Plan")
- User said "change this part" or "revise the approach" for the EXISTING plan
- Iterating on the same plan during the planning phase

**handoff**: Use when:
- Plan has been verified by the user
- Ready to switch to Agent mode for implementation

CRITICAL: Once handoff is executed, that plan is DONE. Any new user request should use create_plan, NOT update_plan.

### Mode: create_plan
Create a detailed implementation plan in markdown format.

Parameters:
- mode: "create_plan"
- title: Plan title (optional, defaults to "Implementation Plan")
- plan: Markdown content with the full plan (required)

The plan should include:
- Overview of the approach
- Step-by-step implementation tasks
- File changes needed
- Dependencies or prerequisites
- Potential risks or considerations

The plan is saved to .echode/plan-{uuid}.md and opened in VS Code. User must click "Verify Plan" to continue.

NOTE: The tool result contains "planFilePath", but the system automatically tracks this for future updates.

### Mode: update_plan
Update an existing plan when user provides feedback instead of verifying.

Parameters:
- mode: "update_plan"
- title: Plan title (optional, defaults to "Implementation Plan")
- plan: Updated markdown content with the revised plan (required)
- planFilePath: (Optional) The system automatically tracks the active plan. Only provide this if you need to override the active plan.

Use when:
- User provides feedback on the created plan instead of clicking "Verify Plan"
- Plan needs adjustments based on user's comments
- Iterating on the plan before final verification

NOTE: You do not need to track the "planFilePath". The system remembers the last created or updated plan automatically.

The updated plan replaces the existing file. User must click "Verify Plan" to continue.

### Mode: handoff
Signal readiness to switch to agent mode for implementation.

Parameters:
- mode: "handoff"
- summary: Brief summary of what will be implemented (optional)

Use when:
- Plan has been verified by the user
- Ready to start actual code implementation
- All clarifications have been addressed

User must click "Start Implementation" to switch to Agent mode.

### Important Behavior
- After executing plan tool, STOP and wait for user interaction
- Do NOT continue generating content after plan tool execution
- The user must click the appropriate button to proceed
- When user provides feedback instead of verifying, use update_plan mode
- The system automatically tracks the active plan file, so you rarely need to handle file paths manually`;
}