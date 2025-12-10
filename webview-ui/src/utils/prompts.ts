/**
 * Prompt System - Re-export from organized prompts folder
 * 
 * This file is kept for backward compatibility.
 * All prompt logic has been moved to the prompts/ folder organized by mode.
 * 
 * Structure:
 *   prompts/
 *     ├── index.ts           (main entry)
 *     ├── shared/            (shared components)
 *     ├── agent/             (Agent mode)
 *     ├── plan/              (Plan mode)
 *     ├── ask/               (Ask mode)
 *     ├── general/           (General mode)
 *     └── chat/              (Chat mode - no tools)
 */

// Re-export everything from the new organized prompts folder
export {
  getSystemPrompt,
  getPromptConfig,
  type PromptConfig,
  // Mode-specific builders
  buildAgentPrompt,
  buildPlanPrompt,
  buildAskPrompt,
  buildGeneralPrompt,
  buildChatPrompt,
  // Mode-specific reminders (for streaming handlers)
  getAgentSystemReminder,
  getAgentTodoReminder,
  getPlanSystemReminder,
  getPlanTodoReminder,
  getAskSystemReminder,
  getAskTodoReminder,
  getGeneralSystemReminder,
  getGeneralTodoReminder,
} from '../prompts';
