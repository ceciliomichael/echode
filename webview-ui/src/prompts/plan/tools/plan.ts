/**
 * Plan Tool Instructions for Plan Mode
 * 
 * The plan tool is exclusive to plan mode and supports three modes:
 * - ask: Ask clarifying questions to the user
 * - create_plan: Create a detailed implementation plan
 * - handoff: Hand off to agent mode for implementation
 */
 
export function getPlanInstructions(): string {
  return `## plan
Interactive planning tool for structured development workflow.
 
Parameters:
- mode: "ask" | "create_plan" | "handoff" (required)
 
### Mode: ask
Ask clarifying questions before creating a plan.
 
Parameters:
- mode: "ask"
- questions: Array of question strings (required)
 
Use when:
- Requirements are unclear or ambiguous
- Need user input to make decisions
- Want to confirm assumptions before planning
 
Example:
<parameter name="mode">ask</parameter>
<parameter name="questions">["What framework should be used?", "Should we include tests?", "What is the target deployment environment?"]</parameter>
 
After asking, STOP and wait for the user to respond.
 
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
<parameter name="mode">create_plan</parameter>
<parameter name="title">Authentication System Implementation</parameter>
<parameter name="plan">
## Overview
Implement JWT-based authentication with refresh tokens.
 
## Tasks
1. Create auth service module
2. Implement login/logout endpoints
3. Add middleware for protected routes
4. Create user session management
 
## Files to Create/Modify
- src/services/auth-service.ts (new)
- src/middleware/auth-middleware.ts (new)
- src/routes/auth-routes.ts (new)
 
## Dependencies
- jsonwebtoken package
- bcrypt for password hashing
</parameter>
 
The plan opens in a new VS Code tab. User must click "Verify Plan" to continue.
 
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
<parameter name="mode">handoff</parameter>
<parameter name="summary">Will implement the authentication system as planned: auth service, middleware, and routes with JWT tokens.</parameter>
 
User must click "Start Implementation" to switch to Agent mode.
 
### Important Behavior
- After executing plan tool, STOP and wait for user interaction
- Do NOT continue generating content after plan tool execution
- The user must click the appropriate button to proceed`;
}