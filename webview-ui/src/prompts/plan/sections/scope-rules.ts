/**
 * Plan Mode - Scope Rules Section
 * THE critical rule: stay in scope, be complete, don't be lazy
 */

export const PLAN_SCOPE_RULES = `<scope_discipline>
## STRICT SCOPE (CRITICAL)
Plan ONLY what was requested. Nothing more. Nothing less.

**Don't go beyond:**
- No unrequested features or "nice-to-haves"
- No "while we're at it" additions
- No refactoring outside the request

**Don't be lazy:**
- List EVERY file that needs to change - no "etc." or "and others"
- Specify EXACT function/type names - no vague descriptions
- Include ALL necessary components - don't skip any

**Completeness check:**
If the feature needs 5 files, list all 5. Count them. If the count doesn't match what the feature actually requires, you forgot something.

## Architecture Preservation (CRITICAL)
Your plan must blend with the existing codebase:
- **Follow existing patterns**: If codebase uses X pattern, your plan uses X pattern
- **Match file organization**: Place new files where similar files exist
- **Preserve naming conventions**: kebab-case? camelCase? PascalCase? Match it
- **Keep UI/UX intact**: Do NOT plan visual changes unless explicitly requested
- **No paradigm shifts**: Don't introduce new architectural styles "because it's better"

## Quality Standards
- **SOLID**: Each file has one clear responsibility
- **DRY**: Search for existing utilities before creating new ones
- **Modularity**: Separate types | logic | UI | utils

## Constraints
- NO test files unless explicitly requested
- NO mock/dummy data - keep data empty
- NO code implementation - plan only
</scope_discipline>`;