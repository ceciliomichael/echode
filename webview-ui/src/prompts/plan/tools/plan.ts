/**
 * Plan Tool Instructions for Plan Mode
 * 
 * The plan tool is exclusive to plan mode and supports four modes:
 * - ask: Ask clarifying questions to the user
 * - create_plan: Create a detailed implementation plan
 * - update_plan: Update an existing plan based on user feedback
 * - handoff: Hand off to agent mode for implementation
 */
 
export function getPlanInstructions(): string {
  return `## plan
Interactive planning tool for structured development workflow.
 
Parameters:
- mode: "create_plan" | "update_plan" | "handoff" (required)
 
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
 
Example:
\`\`\`xml
<invoke name="plan">
<parameter name="mode">create_plan</parameter>
<parameter name="title">Authentication System Implementation</parameter>
<parameter name="plan">
## Overview
Implement JWT-based authentication with refresh tokens.
 
## Tasks
1. Create auth service module
2. Implement login/logout endpoints
3. Add middleware for protected routes
</parameter>
</invoke>
\`\`\`
 
The plan is saved to .echode/plan-{uuid}.md and opened in VS Code. User must click "Verify Plan" to continue.

IMPORTANT: The tool result will contain "planFilePath" - you MUST save this exact path for use with update_plan mode.
 
### Mode: update_plan
Update an existing plan when user provides feedback instead of verifying.
 
Parameters:
- mode: "update_plan"
- title: Plan title (optional, defaults to "Implementation Plan")
- plan: Updated markdown content with the revised plan (required)
- planFilePath: The EXACT path from the previous create_plan/update_plan result (required)
 
Use when:
- User provides feedback on the created plan instead of clicking "Verify Plan"
- Plan needs adjustments based on user's comments
- Iterating on the plan before final verification

CRITICAL RULES:
1. The planFilePath MUST be the EXACT value from the previous tool result's "planFilePath" field
2. DO NOT make up or guess the path - it contains a UUID like "plan-a1b2c3d4-e5f6-7890-abcd-ef1234567890.md"
3. If you don't have the planFilePath from a previous result, use create_plan instead
 
Example (assuming previous create_plan returned planFilePath: "/workspace/.echode/plan-a1b2c3d4-e5f6-7890-abcd-ef1234567890.md"):
\`\`\`xml
<invoke name="plan">
<parameter name="mode">update_plan</parameter>
<parameter name="title">Authentication System Implementation</parameter>
<parameter name="planFilePath">/workspace/.echode/plan-a1b2c3d4-e5f6-7890-abcd-ef1234567890.md</parameter>
<parameter name="plan">
## Overview
Updated plan based on user feedback...
 
## Tasks
1. Updated task list...
</parameter>
</invoke>
\`\`\`
 
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
 
Example:
\`\`\`xml
<invoke name="plan">
<parameter name="mode">handoff</parameter>
<parameter name="summary">Will implement the authentication system as planned.</parameter>
</invoke>
\`\`\`
 
User must click "Start Implementation" to switch to Agent mode.
 
### Important Behavior
- After executing plan tool, STOP and wait for user interaction
- Do NOT continue generating content after plan tool execution
- The user must click the appropriate button to proceed
- When user provides feedback instead of verifying, use update_plan mode
- ALWAYS use the EXACT planFilePath from the previous create_plan or update_plan result - NEVER make up a path`;
}