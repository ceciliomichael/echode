/**
 * Preservation Rules - Used by Agent mode
 * 
 * Ensures the agent maintains existing architecture, UI/UX design,
 * and code patterns rather than making unnecessary changes.
 */

export const PRESERVATION_RULES = `PRESERVATION (CRITICAL - User's Work Must Stay Consistent):
- ARCHITECTURE: Follow the EXISTING folder structure, naming conventions, and design patterns already in the codebase.
  * Do NOT reorganize or rename files/folders unless explicitly requested
  * Do NOT change import patterns or module structure that already works
  * Match the existing code style (formatting, naming, patterns) in the project
  * If adding new files, place them where similar files already exist
- UI/UX: NEVER change visual design unless explicitly asked to.
  * Preserve existing colors, spacing, typography, and component styles
  * Do NOT "improve" or "modernize" UI that wasn't requested to change
  * Keep existing Tailwind classes, CSS styles, or design tokens as they are
  * Match the existing design language when adding new UI elements
  * If unsure about a design choice, ASK the user rather than changing it
- CONSISTENCY: The user's existing work is intentional. Respect it.
  * Treat existing patterns as the "source of truth" for new code
  * Do NOT refactor working code just because you prefer a different approach
  * Only change what the user explicitly asks to be changed`;