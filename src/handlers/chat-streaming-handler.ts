import * as vscode from 'vscode';
import { LLMFactory } from '../services/llm/llm-factory';
import { ChatMessage, ChatMessageContent, ChatStreamSettings } from '../services/llm/llm-provider.interface';
import { expandMentions, getWorkspaceRoot } from '../services/mention-service';
import { mergeSameRoleChatMessages } from '../utils/message-merger';

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
    // Clone messages and expand mentions in user messages
    const workspaceRoot = getWorkspaceRoot();
    const processedMessages = await Promise.all(
      messages.map(async (m) => {
        const cloned = { ...m };

        // Expand @file mentions in user messages
        if (cloned.role === 'user' && workspaceRoot) {
          if (Array.isArray(cloned.content)) {
            // Handle multimodal content
            cloned.content = await Promise.all(
              cloned.content.map(async (c) => {
                if (c.type === 'text' && c.text) {
                  return { ...c, text: await expandMentions(c.text, workspaceRoot) };
                }
                return c;
              })
            ) as ChatMessageContent[];
          } else if (typeof cloned.content === 'string') {
            cloned.content = await expandMentions(cloned.content, workspaceRoot);
          }
        }

        return cloned;
      })
    );

    if (processedMessages.length > 0) {
      const lastMessage = processedMessages[processedMessages.length - 1];
      if (lastMessage.role === 'user') {
        // Get chat mode from settings - skip reminders for Chat mode
        const chatMode = settings.chatMode || 'agent';

        // Chat mode: NO tools, NO system reminder about tools
        if (chatMode !== 'chat') {
          // Get enabled tools from settings
          const enabledTools = settings.enabledTools?.filter(t => t.enabled) || [];
          const enabledToolNames = enabledTools.map(t => `\`${t.id}\``).join(', ') || '';

          let toolsMessage = '';
          if (enabledTools.length === 0) {
            toolsMessage = '\nNo tools are currently enabled. You cannot use any tools for this request.';
          } else {
            const modeLabel = chatMode === 'plan' ? 'AVAILABLE' : 'ENABLED';
            toolsMessage = `\n${modeLabel} TOOLS: ${enabledToolNames}\nThese are the ONLY tools you can use. Do not attempt to use any other tools.`;
          }

          // Mode-specific reminder content
          let modeSpecificReminder = '';
          if (chatMode === 'plan') {
            modeSpecificReminder = '\n- You are in PLANNING mode - explore and plan, do NOT implement.';
          } else if (chatMode === 'ask') {
            modeSpecificReminder = '\n- You are in Q&A mode - answer questions, do NOT implement changes.';
          }

          const systemReminder = `\n\n<system_reminder>\nPlease remember:${toolsMessage}
- Use only the XML format: <function_calls><invoke name="TOOL">...</invoke></function_calls>
- Avoid redundant file reads when you already have the necessary code in context, but if you are unsure or need to verify details, call the relevant tool again instead of guessing.
- Do not nest tool XML inside parameters.
- Keep tool syntax internal. Never show it to the user.
- Always base code descriptions and edits on the latest tool output you have. If you are missing details, fetch them with tools first.
- Stay focused on the current task.${modeSpecificReminder}
</system_reminder>`;

          // Handle multimodal content (text + images) properly
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
        // Chat mode: no system_reminder injected at all
      }
    }

    // Merge consecutive same-role messages for cleaner context (KiloCode pattern)
    const mergedMessages = mergeSameRoleChatMessages(processedMessages);

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
