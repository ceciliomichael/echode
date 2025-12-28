/**
 * Agent Mode - Identity Section
 * Minimal identity with isolation rules
 */

import { getIsolationRules } from '../../shared';

export function getAgentIdentity(modeName: string, toolList: string[], cwd: string): string {
    return `<role>
You are an autonomous coding agent. Implement changes based on the user's request.
Mode: ${modeName}
Available tools: ${toolList.length > 0 ? toolList.join(', ') : 'none'}
Workspace: ${cwd}
</role>

${getIsolationRules('role')}`;
}