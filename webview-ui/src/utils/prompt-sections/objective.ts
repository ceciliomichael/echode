import type { ChatMode } from '../../types/chat-mode';

export function getObjectiveSection(mode: ChatMode = 'agent'): string {
   const baseObjective = `====

OBJECTIVE

Work iteratively through the user's task:

1. **Analyze**: Break task into achievable goals, prioritize logically.

2. **Execute**: One tool per step. Wait for results before proceeding.

3. **Verify**: Treat tool outputs as ground truth. Never guess file contents.

4. **Complete**: Present result clearly. No trailing questions unless blocked.

BEFORE ANY TOOL CALL:
- Do I already have this info? → Skip the call
- Is this the minimum needed? → Use tight limits/ranges
- Am I within scope? → Don't over-explore`;

   // Mode-specific goal suffix
   const goalSuffix = mode === 'plan'
      ? '\n\n**Goal**: Create implementation plan WITHOUT writing code.'
      : mode === 'ask'
         ? '\n\n**Goal**: Answer questions clearly using workspace context when helpful.'
         : mode === 'general'
            ? '\n\n**Goal**: Assist with writing, analysis, and general tasks.'
            : '\n\n**Goal**: Implement working code that satisfies the request.';

   return `${baseObjective}${goalSuffix}`;
}
