import type { WorkspaceContext } from '../../types/workspace';
import { storageService } from '../../utils/storage';

export function getUserRules(workspace: WorkspaceContext | null): string {
    const customSystemPrompt = storageService.getSystemPrompt();
    const agentsConfig = workspace?.agentsConfig;

    const parts: string[] = [];

    if (agentsConfig && agentsConfig.trim().length > 0) {
        parts.push(`<workspace_rules source="AGENTS.md" priority="high">
${agentsConfig}
</workspace_rules>`);
    }

    if (customSystemPrompt && customSystemPrompt.trim().length > 0) {
        parts.push(`<custom_instructions priority="highest">
${customSystemPrompt}
</custom_instructions>`);
    }

    if (parts.length === 0) {return '';}

    return `<user_rules>
${parts.join('\n')}
</user_rules>`;
}
