import * as vscode from 'vscode';
import { LLMFactory } from '../services/llm/llm-factory';
import { ChatMessage, ChatStreamSettings } from '../services/llm/llm-provider.interface';
import { mergeSameRoleChatMessages } from '../utils/message-merger';
import { processTodoReminders } from '../utils/todo-reminder';
import { defaultRegistry } from '../services/tools/tool-registry';
import { MCPToolAdapter } from '../services/mcp/mcp-tool-adapter';
import { LLMValidator } from '../services/llm/llm-validator';

interface ChatStreamRequest {
  requestId: number;
  messages: ChatMessage[];
  settings: ChatStreamSettings;
}

// Registry to track active streams for cancellation
const activeStreams = new Map<number, AbortController>();

/**
 * Handle chat streaming requests from webview through backend SDKs
 */
export async function handleChatStream(
  data: unknown,
  webview: vscode.WebviewView | vscode.WebviewPanel
): Promise<void> {
  const request = data as ChatStreamRequest;
  const { requestId, messages, settings } = request;

  // Handle abort request
  if ((data as any).type === 'chatStreamAbort') {
    const controller = activeStreams.get(requestId);
    if (controller) {
      controller.abort();
      activeStreams.delete(requestId);
    }
    return;
  }

  // Create abort controller for this stream
  const abortController = new AbortController();
  activeStreams.set(requestId, abortController);

  try {
    // Validate settings before proceeding
    LLMValidator.validateSettings(settings);

    // Clone messages for processing
    const processedMessages = messages.map(m => ({ ...m }));

    // Get chat mode from settings
    const chatMode = settings.chatMode || 'agent';

    // Process todo reminders: strip old ones, inject fresh (skip for chat mode)
    const messagesWithTodos = chatMode !== 'chat'
      ? processTodoReminders(processedMessages)
      : processedMessages;

    if (messagesWithTodos.length > 0) {
      const lastMessage = messagesWithTodos[messagesWithTodos.length - 1];
      if (lastMessage.role === 'user') {

        // Tool logic (MCP allowed in all modes, Standard tools restricted in Chat)
        {
          // Get enabled tools from settings (standard tools)
          // In Chat mode, standard tools are disabled
          const rawEnabledTools = settings.enabledTools?.filter(t => t.enabled) || [];
          const enabledStandardTools = chatMode === 'chat' ? [] : rawEnabledTools;
          
          // Get MCP tools from registry (they are enabled if present in registry)
          const allRegistryTools = defaultRegistry.getTools();
          const mcpTools = allRegistryTools.filter(t => t instanceof MCPToolAdapter);
          
          // Combine standard tools and MCP tools names
          // For standard tools we use t.id (which matches registry name usually), for MCP tools t.name
          const standardToolNames = enabledStandardTools.map(t => `\`${t.id}\``);
          const mcpToolNames = mcpTools.map(t => `\`${t.name}\``);
          
          const allEnabledToolNames = [...standardToolNames, ...mcpToolNames];
          const enabledToolNamesString = allEnabledToolNames.join(', ') || '';

          let toolsMessage = '';
          if (allEnabledToolNames.length === 0) {
            toolsMessage = '\nNo tools are currently enabled. You cannot use any tools for this request.';
          } else {
            const modeLabel = chatMode === 'plan' ? 'AVAILABLE' : 'ENABLED';
            toolsMessage = `\n${modeLabel} TOOLS: ${enabledToolNamesString}\nThese are the ONLY tools you can use. Do not attempt to use any other tools.`;
          }

          // Inject MCP tool instructions into the system prompt
          // Allowed in ALL modes
          const shouldInjectMcp = true;

          // Find the system message
          const systemMessage = messagesWithTodos.find(m => m.role === 'system');
          if (systemMessage && mcpTools.length > 0 && shouldInjectMcp) {
            const mcpInstructions = mcpTools
              .map(t => t.getInstruction())
              .join('\n\n');
            
            // Append to the system message content
            const additionalContext = `\n\n<mcp_tool_instructions>\nThe following additional tools are available for you to use:\n\n${mcpInstructions}\n</mcp_tool_instructions>`;
            
            if (typeof systemMessage.content === 'string') {
              systemMessage.content += additionalContext;
            } else if (Array.isArray(systemMessage.content)) {
              // Handle multimodal system message
              const textContent = systemMessage.content.find(c => c.type === 'text');
              if (textContent && textContent.text) {
                textContent.text += additionalContext;
              }
            }
          }

          // Mode-specific reminder content
          let modeSpecificReminder = '';
          if (chatMode === 'plan') {
            modeSpecificReminder = '\n- You are in PLANNING mode - explore and plan, do NOT implement.';
          } else if (chatMode === 'ask') {
            modeSpecificReminder = '\n- You are in Q&A mode - answer questions, do NOT implement changes.';
          }

          const systemReminder = `\n\n<system_reminder>\nPlease remember:${toolsMessage}
- Use only the XML format: <function_calls><invoke name="tool_name">...</invoke></function_calls>
- For apply_diff: Use ONE search/replace block per invocation. Multiple blocks are strictly forbidden.
- Avoid redundant file reads when you already have the necessary code in context, but if you are unsure or need to verify details, call the relevant tool again instead of guessing.
- Do not nest tool XML inside parameters.
- Keep tool syntax internal. Never show it to the user.
- Always base code descriptions and edits on the latest tool output you have. If you are missing details, fetch them with tools first.
- Stay focused on the current task.${modeSpecificReminder}
</system_reminder>`;

          // Handle multimodal content (text + images) properly
          // For 'chat' mode, only inject system reminder if tools are actually available (MCP tools).
          // For other modes, always inject (even to say "No tools enabled").
          const shouldInjectReminder = chatMode !== 'chat' || allEnabledToolNames.length > 0;

          if (shouldInjectReminder) {
            if (Array.isArray(lastMessage.content)) {
              // Find the text content and append system reminder
              const textContent = lastMessage.content.find(c => c.type === 'text');
              if (textContent && textContent.text !== undefined) {
                textContent.text += systemReminder;
              }
            } else {
              // Simple string content
              lastMessage.content += systemReminder;
            }
          }
        }
      }
    }

    // Merge consecutive same-role messages for cleaner context (KiloCode pattern)
    const mergedMessages = mergeSameRoleChatMessages(messagesWithTodos);

    const provider = LLMFactory.getProvider(settings.provider);
    await provider.streamChat(requestId, mergedMessages, settings, webview, abortController.signal);
  } catch (error) {
    // Only send error if not aborted
    if (error instanceof Error && error.name !== 'AbortError') {
      webview.webview.postMessage({
        type: 'chatStreamError',
        requestId,
        error: error.message
      });
    }
  } finally {
    // Clean up
    activeStreams.delete(requestId);
  }
}
