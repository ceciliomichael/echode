import type { WorkspaceContext } from '../../types/workspace';
import { storageService } from '../../utils/storage';

export function getUserRules(workspace: WorkspaceContext | null): string {
    const customSystemPrompt = storageService.getSystemPrompt();
    const agentsConfig = workspace?.agentsConfig;

    const parts: string[] = [];

    if (agentsConfig && agentsConfig.trim().length > 0) {
        parts.push(`<workspace_development_rules>
# This is user workspace_development_rules, always follow it, user is always priotity, second to tool instructions.
${agentsConfig}
</workspace_rules>`);
    }

    if (customSystemPrompt && customSystemPrompt.trim().length > 0) {
        parts.push(`<custom_instructions>
# This is the user custom_instructions, always follow it, user is always priotity, second to tool instructions.
${customSystemPrompt}
</custom_instructions>`);
    }

    if (parts.length === 0) {return '';}

    return `<user_rules>
${parts.join('\n')}
</user_rules>`;
}
