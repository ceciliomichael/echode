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
import { buildReviewPrompt } from './review';
import { storageService } from '../utils/storage';
import { getToolsForMode } from '../lib/tool-config';


/**
 * Get the enabled tools for a specific mode, applying user preferences
 * and strictly enforcing mode restrictions.
 */
function getEnabledToolsForMode(mode: ChatMode): Tool[] {
    if (mode === 'chat') {
        return []; // Chat mode has no tools
    }

    const savedTools = storageService.getEnabledTools();
    const settings = storageService.getSettings();
    const echoSearchEnabled = settings.indexingSettings?.enabled ?? true;

    // 1. Get tools allowed for the current mode (Source of Truth)
    const modeTools = getToolsForMode(mode, true);

    // Create a set of allowed IDs for this mode for O(1) verification
    const allowedIds = new Set(modeTools.map(t => t.id));

    // 2. Apply user preferences
    const userEnabledMap = new Map(savedTools?.map(t => [t.id, t.enabled]));

    let baseTools = modeTools.map(tool => {
        if (userEnabledMap.has(tool.id)) {
            // Respect user preference ONLY if it's an allowed tool
            return { ...tool, enabled: userEnabledMap.get(tool.id)! };
        }
        return tool;
    });

    // 3. Filter out echo_search if indexing is disabled
    if (!echoSearchEnabled) {
        baseTools = baseTools.filter(tool => tool.id !== 'echo_search');
    }

    // 4. FINAL SAFETY CHECKS
    return baseTools.filter(tool => {
        // Must be enabled
        if (!tool.enabled) {return false;}

        // Must be in the allowed ID set for this mode (Redundant but safe)
        if (!allowedIds.has(tool.id)) {return false;}

        return true;
    });
}

/**
 * Build the system prompt for a specific mode
 * This is the main entry point for prompt generation
 */
export function getSystemPrompt(workspace: WorkspaceContext | null, mode: ChatMode = 'agent'): string {
    const enabledTools = getEnabledToolsForMode(mode);
    const settings = storageService.getSettings();
    
    // Get miscellaneous settings for terminal access
    const fullTerminalAccess = settings.miscellaneousSettings?.enableFullTerminalAccess ?? false;

    switch (mode) {
        case 'chat':
            return buildChatPrompt({ workspace });

        case 'general':
            return buildGeneralPrompt({ workspace, enabledTools });

        case 'ask':
            return buildAskPrompt({ workspace, enabledTools });

        case 'plan':
            return buildPlanPrompt({ workspace, enabledTools });

        case 'yolo':
            // YOLO mode starts with Plan prompt (internally acts as Plan first)
            // After auto-verify, it switches to Agent prompt via lockedMode
            // Key difference: isYoloMode=true skips clarification questions
            return buildPlanPrompt({ workspace, enabledTools, isYoloMode: true });

        case 'review':
            return buildReviewPrompt({ workspace, enabledTools });

        case 'agent':
        default:
            return buildAgentPrompt({ workspace, enabledTools, fullTerminalAccess });
    }
}

// Re-export mode-specific builders for direct access
export { buildAgentPrompt } from './agent';
export { buildPlanPrompt } from './plan';
export { buildAskPrompt } from './ask';
export { buildGeneralPrompt } from './general';
export { buildChatPrompt } from './chat';
export { buildReviewPrompt } from './review';
