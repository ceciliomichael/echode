import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { chatApi } from '../services/chat-api';
import { getSystemPrompt } from '../utils/prompts';
import { requestWorkspaceInfo } from '../utils/workspace-info';
import { useWorkspaceContext } from './use-workspace-context';
import type { Message, ImageAttachment } from '../types/chat';
import type { ChatMessage } from '../types/chat-api';
import type { ChatMode } from '../types/chat-mode';
import { hasCompleteToolBlock, trimToFirstCompleteToolBlock } from '../lib/tool-parser';
import { removeThinkBlocks } from '../utils/think-block-parser';
import { buildChatMessage, getCurrentModel, isVisionCapableModel } from '../utils/vision-utils';
import { isToolAvailableInMode } from '../utils/tool-history-filter';

const MAX_HISTORY_MESSAGES = 20;
const MAX_FILE_CONTENT_CHARS = 8000;

function trimHistory(history: ChatMessage[]): ChatMessage[] {
  if (history.length <= MAX_HISTORY_MESSAGES) {
    return history;
  }

  const [systemMessage, ...rest] = history;
  const kept = rest.slice(-Math.max(1, MAX_HISTORY_MESSAGES - 1));
  return [systemMessage, ...kept];
}

function truncateContent(content: string, maxChars: number): string {
  if (content.length <= maxChars) {
    return content;
  }
  return `${content.slice(0, maxChars)}\n...[truncated file content]`;
}

// Escape XML special characters to prevent breaking tool block parsing
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface ChatStreamingProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  setIsExecutingTool: React.Dispatch<React.SetStateAction<boolean>>;
  isStreamingRef: React.MutableRefObject<boolean>;
  sendingMessageRef: React.MutableRefObject<boolean>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  executeToolAndContinue: (
    assistantContent: string,
    assistantMessageId: string,
    chatHistory: ChatMessage[],
    messagesToSend: Message[],
    userContent: string,
    toolIndex?: number,
    userAttachments?: ImageAttachment[]
  ) => Promise<void>;
  saveSession: () => void;
  mode: ChatMode;
}

export function useChatStreaming({
  messages,
  setMessages,
  setIsStreaming,
  setIsExecutingTool,
  isStreamingRef,
  sendingMessageRef,
  abortControllerRef,
  executeToolAndContinue,
  saveSession,
  mode,
}: ChatStreamingProps) {
  const workspace = useWorkspaceContext();

  const sendMessage = useCallback(async (content: string, attachments?: ImageAttachment[], overrideMessages?: Message[], isHidden: boolean = false, forceEchoSearch: boolean = false) => {
    // Prevent starting new stream if already streaming
    if (isStreamingRef.current) {
      console.warn('[Chat] Already streaming, ignoring new message request');
      return;
    }
    
    // Prevent concurrent sendMessage executions
    if (sendingMessageRef.current) {
      console.warn('[Chat] Message already being sent, ignoring request');
      return;
    }
    
    sendingMessageRef.current = true;
    isStreamingRef.current = true;
    setIsStreaming(true);
    
    // Request fresh workspace info before sending message
    await requestWorkspaceInfo();
    
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date(),
      attachments,
      hidden: isHidden,
    };
    setMessages((prev) => [...prev, userMessage]);
    
    // Save immediately after user message to ensure it's persisted even if AI crashes
    // Use setTimeout to allow state update to propagate to messagesRef
    setTimeout(() => saveSession(), 0);

    // Create a new assistant message for AI responses
    let assistantContent = '';
    let pendingUpdate = false;
    
    const assistantMessageId = uuidv4();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const latestWorkspace = window.workspaceContext || workspace;
      const systemPrompt = getSystemPrompt(latestWorkspace, mode);
      
      // Use override messages if provided (for edit flow), otherwise use current messages
      const messagesToSend = overrideMessages !== undefined ? overrideMessages : messages;
      
      // Check if current model supports vision
      const currentModel = getCurrentModel();
      const modelSupportsVision = isVisionCapableModel(currentModel);
      
      console.log('[Chat] Model info:', { currentModel, modelSupportsVision });
      console.log('[Chat] User message has attachments:', attachments?.length || 0);
      
      // FORCED ECHO SEARCH: Bypass LLM and execute echo_search directly
      if (forceEchoSearch && mode === 'agent') {
        console.log('[Chat] Forced echo_search triggered - executing directly without LLM');
        
        // Create synthetic assistant content with echo_search tool block
        // Must match the expected format: <function_calls><invoke name="tool">...
        // Escape XML special characters to prevent breaking the tool block structure
        const escapedContent = escapeXml(content);
        const syntheticToolBlock = `<function_calls>
<invoke name="echo_search">
<parameter name="query">${escapedContent}</parameter>
</invoke>
</function_calls>`;
        
        assistantContent = syntheticToolBlock;
        
        // Update UI immediately with the tool block
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: assistantContent }
              : msg
          )
        );
        
        // Set executing tool state immediately
        setIsExecutingTool(true);
        
        // Build minimal chat history for continuation after tool execution
        const chatHistory: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
        ];
        
        // Add previous messages
        for (const msg of messagesToSend) {
          const contentWithoutThinking = removeThinkBlocks(msg.content);
          const chatMessage = buildChatMessage(
            msg.role,
            contentWithoutThinking,
            msg.attachments,
            modelSupportsVision
          );
          chatHistory.push(chatMessage);
        }
        
        // Add current user message
        const finalUserMessage = buildChatMessage(
          'user',
          content,
          attachments,
          modelSupportsVision
        );
        chatHistory.push(finalUserMessage);
        
        // Execute tool directly and continue
        await executeToolAndContinue(
          assistantContent,
          assistantMessageId,
          chatHistory,
          messagesToSend,
          content,
          0,
          attachments
        );
        
        return; // Exit early, tool execution handles continuation
      }
      
      // Build chat history with system prompt + all messages + tool results
      const chatHistory: ChatMessage[] = [
        {
          role: 'system',
          content: systemPrompt,
        },
      ];
      
      // Add messages with tool results embedded
      for (const msg of messagesToSend) {
        // Strip <think> and <thinking> blocks from message content before adding to chat history
        const contentWithoutThinking = removeThinkBlocks(msg.content);
        
        // Build message with vision support if available
        const chatMessage = buildChatMessage(
          msg.role,
          contentWithoutThinking,
          msg.attachments,
          modelSupportsVision
        );
        chatHistory.push(chatMessage);
        
        // If this message has tool executions, add them as context
        // Filter to only include tools available in current mode
        if (msg.toolExecutions && msg.toolExecutions.size > 0) {
          const toolResults: string[] = [];
          const skippedTools: string[] = [];
          msg.toolExecutions.forEach((execution) => {
            // Skip tools not available in current mode to prevent AI confusion
            if (!isToolAvailableInMode(execution.toolName, mode)) {
              skippedTools.push(execution.toolName);
              return;
            }
            if (execution.status === 'completed' && execution.result) {
              if (execution.result.success) {
                // Format result based on tool type
                const data = execution.result.data as Record<string, unknown>;
                let formattedResult = '';
                
                if (execution.toolName === 'read_file') {
                  // For read_file, handle both single and multiple files
                  if ('files' in data && Array.isArray(data.files)) {
                    // Multiple files case
                    const files = data.files as Array<{ path: string; content: string }>;
                    formattedResult = files
                      .map(f => `File: ${f.path}\n${truncateContent(f.content, MAX_FILE_CONTENT_CHARS)}`)
                      .join('\n\n---\n\n');
                  } else if ('content' in data && 'path' in data) {
                    // Single file case
                    formattedResult = `File: ${data.path as string}\n${truncateContent(String(data.content), MAX_FILE_CONTENT_CHARS)}`;
                  } else {
                    formattedResult = JSON.stringify(data);
                  }
                } else if (execution.toolName === 'grep_search') {
                  // For grep, show matches concisely
                  formattedResult = `Query: ${data.query as string}\nFound ${data.totalMatches as number} matches in ${data.filesWithMatches as number} files`;
                  if (data.results && Array.isArray(data.results) && data.results.length > 0) {
                    formattedResult += '\n' + data.results.slice(0, 5).map((r: Record<string, unknown>) => 
                      `${r.file as string}: ${(r.matches as unknown[]).length} matches`
                    ).join('\n');
                  }
                } else if (execution.toolName === 'list_files') {
                  // For list_files, show directory contents
                  const directories = data.directories as Array<{ name: string }> | undefined;
                  const files = data.files as Array<{ name: string }> | undefined;
                  formattedResult = `Directory: ${data.path as string}\nDirectories: ${directories?.map(d => d.name).join(', ') || 'none'}\nFiles: ${files?.map(f => f.name).join(', ') || 'none'}`;
                } else {
                  // For other tools, stringify the data
                  formattedResult = JSON.stringify(data);
                }
                
                toolResults.push(`[${execution.toolName}]\n${formattedResult}`);
              } else {
                // Tool error
                toolResults.push(`[${execution.toolName} ERROR]\n${execution.result.error}`);
              }
            }
          });
          
          if (toolResults.length > 0) {
            const toolResultsContent = `<tool_results>\n${toolResults.join('\n\n---\n\n')}\n</tool_results>`;
            chatHistory.push({
              role: 'user',
              content: toolResultsContent,
            });
          }
        }
      }
      // Apply history trimming after assembling messages and tool results
      const finalChatHistory = trimHistory(chatHistory);

      // Add current user message with attachments
      const hasToolResults = messagesToSend.some(msg => msg.toolExecutions && msg.toolExecutions.size > 0);
      
      // Build instruction based on context
      let instruction: string;
      if (hasToolResults) {
        instruction = '\n\n[INSTRUCTION: You have tool execution results in <tool_results>. Use them instead of guessing file contents. Follow your system prompt and tool rules. Respond concisely and stay focused on the coding task.]';
      } else {
        instruction = '\n\n[INSTRUCTION: Follow your system prompt and tool rules. Respond concisely and stay focused on the coding task.]';
      }
      
      const finalUserMessage = buildChatMessage(
        'user',
        content + instruction,
        attachments,
        modelSupportsVision
      );
      finalChatHistory.push(finalUserMessage);

      // Batched update function for smooth 60fps rendering
      const updateUI = () => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: assistantContent }
              : msg
          )
        );
        pendingUpdate = false;
      };

      // Auto-retry loop for HTTP errors - keeps trying until success or user abort
      let retryCount = 0;
      let streamSuccess = false;
      
      while (!streamSuccess) {
        try {
          const abortController = new AbortController();
          abortControllerRef.current = abortController;
          
          // Reset content on retry
          if (retryCount > 0) {
            console.log(`[STREAMING] Retry attempt ${retryCount} for stream...`);
            assistantContent = '';
            // Update UI to clear error message
            updateUI();
          }

          console.log('[STREAMING] Starting stream...');
          let chunkCount = 0;
          
          for await (const chunk of chatApi.streamChat(finalChatHistory, abortController.signal, mode)) {
            chunkCount++;
            console.log(`[STREAMING] Chunk #${chunkCount}:`, chunk);
            
            if (abortController.signal.aborted) {
              console.log('[STREAMING] Aborted signal received, breaking stream');
              streamSuccess = true; // User aborted, don't retry
              break;
            }

            assistantContent += chunk;
            console.log(`[STREAMING] Accumulated content length: ${assistantContent.length} chars`);
            
            // Check for complete tool block
            if (hasCompleteToolBlock(assistantContent)) {
              console.log('[STREAMING] ✓ Complete tool block detected!');
              console.log('[STREAMING] Content before trim:', assistantContent.substring(0, 200) + '...');
              
              // Trim content to only include up to the end of the FIRST complete tool block
              // This ensures we execute tools strictly one-by-one and don't include partial content
              const trimmedContent = trimToFirstCompleteToolBlock(assistantContent);
              assistantContent = trimmedContent;
              
              console.log('[STREAMING] Content after trim:', assistantContent.substring(0, 200) + '...');
              console.log('[STREAMING] Trimmed content length:', assistantContent.length);
              
              // Update UI with trimmed content before interrupting
              if (pendingUpdate) {
                updateUI();
              } else {
                updateUI();
              }
              
              console.log('[STREAMING] Aborting stream to execute tool...');
              // Abort stream to execute tool
              abortController.abort();
              
              // Set executing tool state to show loading
              setIsExecutingTool(true);
              
              // Execute tool and continue
              console.log('[STREAMING] Starting tool execution...');
              await executeToolAndContinue(
                assistantContent,
                assistantMessageId,
                finalChatHistory,
                messagesToSend,
                content,
                0, // toolIndex
                attachments // pass image attachments to preserve in history
              );
              
              console.log('[STREAMING] Tool execution completed, exiting stream');
              return; // Exit early, tool execution will handle continuation
            }
            
            // Batch updates: only update UI every 16ms (60fps) for smooth performance
            if (!pendingUpdate) {
              pendingUpdate = true;
              requestAnimationFrame(updateUI);
            }
          }
          
          console.log('[STREAMING] Stream finished naturally, total chunks:', chunkCount);
          console.log('[STREAMING] Final content length:', assistantContent.length);
          
          // Final update to ensure all content is displayed
          if (pendingUpdate) {
            updateUI();
          }
          
          // Stream completed successfully
          streamSuccess = true;
          
        } catch (streamError) {
          const errorMessage = streamError instanceof Error ? streamError.message : 'Unknown error';
          const lowerError = errorMessage.toLowerCase();

          // Detect retryable transient errors:
          // - HTTP errors (500, 502, 503, 504)
          // - JSON parse errors (server returned malformed response)
          // - Service unavailable
          // - Connection errors
          const isRetryableError =
            lowerError.includes('http') ||
            lowerError.includes('500') ||
            lowerError.includes('502') ||
            lowerError.includes('503') ||
            lowerError.includes('504') ||
            lowerError.includes('parse') ||
            lowerError.includes('json') ||
            lowerError.includes('service unavailable') ||
            lowerError.includes('econnreset') ||
            lowerError.includes('etimedout') ||
            lowerError.includes('econnrefused') ||
            lowerError.includes('network') ||
            lowerError.includes('fetch');

          // Check if user manually aborted
          if (abortControllerRef.current?.signal.aborted) {
            console.log('[STREAMING] User aborted, stopping retries');
            streamSuccess = true; // Don't retry on user abort
          } else if (isRetryableError) {
            retryCount++;
            console.warn(`[STREAMING] Transient error, auto-retrying (attempt ${retryCount}):`, errorMessage);

            // Show retry status in UI only if nothing has streamed yet
            if (!assistantContent) {
              assistantContent = `⟳ Retrying... (attempt ${retryCount})`;
              updateUI();
            }

            // Brief delay before retry (exponential backoff capped at 5s)
            await new Promise(resolve => setTimeout(resolve, Math.min(1000 * retryCount, 5000)));
          } else {
            // Non-retryable error, stop without overwriting any streamed content
            console.error('[STREAMING] Non-retryable error:', streamError);
            if (!assistantContent) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: `Error: ${errorMessage}` }
                    : msg
                )
              );
            }
            streamSuccess = true; // Stop retrying for non-retryable errors
          }
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      
      // Only overwrite content with an error if nothing was ever streamed
      if (!assistantContent) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: `Error: ${errorMessage}` }
              : msg
          )
        );
      }
    } finally {
      // Always reset streaming state when done (both ref and state)
      isStreamingRef.current = false;
      setIsStreaming(false);
      if (abortControllerRef.current) {
        abortControllerRef.current = null;
      }
      sendingMessageRef.current = false;
      
      // Save session after stream completion
      saveSession();
    }
  }, [messages, workspace, executeToolAndContinue, setMessages, setIsStreaming, setIsExecutingTool, isStreamingRef, sendingMessageRef, abortControllerRef, saveSession, mode]);

  return { sendMessage };
}
