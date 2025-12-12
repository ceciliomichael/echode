/**
 * Main Prompt System Entry Point
 * 
 * Dispatches to mode-specific prompt builders.
 * Each mode has its own isolated folder with no cross-imports.
 */

import type { WorkspaceContext } from '../types/workspace';
import type { ChatMode } from '../types/chat-mode';
import type { Tool } from '../types/tool';
import { buildAgentPrompt } from './agent';
import { buildPlanPrompt } from './plan';
import { buildAskPrompt } from './ask';
import { buildGeneralPrompt } from './general';
import { buildChatPrompt } from './chat';
import { storageService } from '../utils/storage';
import { getAllTools, getToolsForMode, PLAN_ONLY_TOOL_IDS } from '../lib/tool-config';


/**
 * Get the enabled tools for a specific mode, applying user preferences
 */
function getEnabledToolsForMode(mode: ChatMode): Tool[] {
    if (mode === 'chat') {
        return []; // Chat mode has no tools
    }

    const savedTools = storageService.getEnabledTools();
    const settings = storageService.getSettings();
    const echoSearchEnabled = settings.indexingSettings?.enabled ?? true;

    // Get tools allowed for the current mode
    const modeTools = mode === 'plan'
        ? getToolsForMode('plan', true)
        : mode === 'ask'
            ? getToolsForMode('ask', true)
            : mode === 'general'
                ? getToolsForMode('general', true)
                : getAllTools(true).filter(tool => !PLAN_ONLY_TOOL_IDS.has(tool.id));

    // Apply user preferences
    const userEnabledMap = new Map(savedTools?.map(t => [t.id, t.enabled]));

    let baseTools = modeTools.map(tool => {
        if (userEnabledMap.has(tool.id)) {
            return { ...tool, enabled: userEnabledMap.get(tool.id)! };
        }
        return tool;
    });

    // Filter out echo_search if indexing is disabled
    if (!echoSearchEnabled) {
        baseTools = baseTools.filter(tool => tool.id !== 'echo_search');
    }

    return baseTools.filter(tool => tool.enabled);
}

/**
 * Build the system prompt for a specific mode
 * This is the main entry point for prompt generation
 */
export function getSystemPrompt(workspace: WorkspaceContext | null, mode: ChatMode = 'agent'): string {
    const enabledTools = getEnabledToolsForMode(mode);

    switch (mode) {
        case 'chat':
            return buildChatPrompt({ workspace });

        case 'general':
            return buildGeneralPrompt({ workspace, enabledTools });

        case 'ask':
            return buildAskPrompt({ workspace, enabledTools });

        case 'plan':
            return buildPlanPrompt({ workspace, enabledTools });

        case 'agent':
        default:
            return buildAgentPrompt({ workspace, enabledTools });
    }
}

// Re-export mode-specific builders for direct access
export { buildAgentPrompt } from './agent';
export { buildPlanPrompt } from './plan';
export { buildAskPrompt } from './ask';
export { buildGeneralPrompt } from './general';
export { buildChatPrompt } from './chat';
