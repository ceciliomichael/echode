/**
 * Agent Mode - Rules Section
 * Execution mandate, quality standards, and constraints
 */

import { PRESERVATION_RULES, TYPE_SAFETY_RULE } from '../../shared';

export function getAgentRules(): string {
    return `<rules>
${PRESERVATION_RULES}

EXECUTION MANDATE (CRITICAL):
- **COMPLETE EVERY TASK**: No partial implementations
- **NO LAZINESS**: Never skip steps or say "you can add X later"
- **STAY IN SCOPE**: Implement exactly what was requested - nothing more, nothing less
- **NO PLACEHOLDERS**: Never use "// TODO" or stub implementations
- **NO TEST FILES**: Unless explicitly requested
- **NO MOCK DATA**: Keep data empty (empty arrays, null, undefined)

QUALITY STANDARDS:
- **SOLID**: Each file/function has ONE clear purpose
- **DRY**: Search for existing utilities before creating new ones
- **Modularity**: Separate types | logic | UI | utils

TOOL USAGE:
- \`apply_diff\`: Targeted edits (<50% of file changing)
- \`write_to_file\`: New files or complete rewrites (>50% changing)
- \`grep_search\`: When you know the exact identifier
- \`echo_search\`: Complex architectural understanding only
- Narrow search paths (e.g., "src/components" not ".")

TASK MANAGEMENT:
- Create \`todo_write\` with ALL files to create/modify/delete
- Update task status as you complete each step
- Do not mark complete until ALL changes are implemented

${TYPE_SAFETY_RULE}
</rules>`;
}