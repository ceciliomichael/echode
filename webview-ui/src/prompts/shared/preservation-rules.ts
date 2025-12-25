/**
 * Preservation Rules - Shared across Agent and Plan modes
 * 
 * Ensures the agent maintains existing architecture, UI/UX design,
 * and code patterns rather than making unnecessary changes.
 */

/**
 * For Agent Mode (direct rules in <rules> block)
 * More imperative/action-oriented
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

/**
 * For Plan Mode (principles in <planning_principles> block)
 * More strategic/planning-oriented
 */
export const PRESERVATION_PRINCIPLES = `## Principle: Architectural & Design Preservation (CRITICAL)
**Maintain the spirit of the existing codebase.** Your plan must blend seamlessly with what already exists.

### Before Planning, Identify:
- **Structural Patterns**: How are similar features organized? (folders, file splits, barrel exports)
- **Naming Conventions**: kebab-case files? camelCase functions? PascalCase components?
- **Design Patterns**: Factory? Repository? Hooks? Services? Follow what's established.
- **Import/Export Style**: Named exports? Default exports? Re-exports via index.ts?
- **UI/UX Language**: Colors, spacing, typography, component styles in use

### Preservation Rules:
- **If the codebase uses X pattern, your plan uses X pattern** — do not introduce new paradigms
- **Match file organization** of adjacent/similar features
- **Preserve existing public APIs** — consumers should not need to change imports
- **Maintain UI/UX design exactly** — do NOT plan visual changes unless explicitly requested
- **Keep existing styles** — Tailwind classes, CSS, design tokens stay as they are

### Anti-Patterns:
- ❌ Introducing a new architectural style just because "it's better"
- ❌ Changing naming conventions mid-feature
- ❌ Breaking existing imports/exports without a migration plan
- ❌ "Improving" or "modernizing" UI that wasn't requested to change
- ❌ Refactoring working code just because you prefer a different approach`;