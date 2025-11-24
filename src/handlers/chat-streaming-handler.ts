import * as vscode from 'vscode';
import { LLMFactory } from '../services/llm/llm-factory';
import { ChatMessage, ChatMessageContent, ChatStreamSettings } from '../services/llm/llm-provider.interface';

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
    // Clone messages and append system reminder to the last user message
    const processedMessages = messages.map(m => ({ ...m }));
    if (processedMessages.length > 0) {
      const lastMessage = processedMessages[processedMessages.length - 1];
      if (lastMessage.role === 'user') {
        // Get enabled tools from settings
        const enabledTools = settings.enabledTools?.filter(t => t.enabled) || [];
        const enabledToolNames = enabledTools.map(t => `\`${t.id}\``).join(', ') || '';
        
        let toolsMessage = '';
        if (enabledTools.length === 0) {
          toolsMessage = '\nNo tools are currently enabled. You cannot use any tools for this request.';
        } else {
          toolsMessage = `\nENABLED TOOLS: ${enabledToolNames}\nThese are the ONLY tools you can use. Do not attempt to use any other tools.`;
        }

        const systemReminder = `\n\n<system_reminder>\nCRITICAL: You must follow all tool usage instructions strictly and accurately.${toolsMessage}\n🚨 TOOL FORMAT: Use ONLY <function_call><tool_name>tool_name</tool_name><param>value</param></function_call> format\n🚫 NEVER use = inside tags! <tool_name=value> is WRONG! Use <tool_name>value</tool_name>\n❌ FORBIDDEN: <tool_name=list_files> ✅ CORRECT: <tool_name>list_files</tool_name>\nNEVER use |tokens| or functions.tool:0 format!\nBe concise and direct in your response.\n</system_reminder>`;

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
    }

    const provider = LLMFactory.getProvider(settings.provider);
    await provider.streamChat(requestId, processedMessages, settings, webview, abortController.signal);
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
