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
    userContent: string
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

  const sendMessage = useCallback(async (content: string, attachments?: ImageAttachment[], overrideMessages?: Message[], isHidden: boolean = false) => {
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
        if (msg.toolExecutions && msg.toolExecutions.size > 0) {
          const toolResults: string[] = [];
          msg.toolExecutions.forEach((execution) => {
            if (execution.status === 'completed' && execution.result) {
              if (execution.result.success) {
                // Format result based on tool type
                const data = execution.result.data as Record<string, unknown>;
                let formattedResult = '';
                
                if (execution.toolName === 'read_file') {
                  // For read_file, include the actual file content
                  formattedResult = `File: ${data.path as string}\n${data.content as string}`;
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
      
      // Add current user message with attachments
      const hasToolResults = messagesToSend.some(msg => msg.toolExecutions && msg.toolExecutions.size > 0);
      const instruction = hasToolResults
        ? '\n\n[INSTRUCTION: You have tool execution results in your context (marked with <tool_results>). Use these results - do NOT make assumptions about file content. If you read a file, use the EXACT content provided in the tool results for your edits. Execute this request while strictly following your system prompt rules, tool protocols, response formats, and user-specific guidelines.]'
        : '\n\n[INSTRUCTION: Execute this request while strictly following your system prompt rules, tool protocols, response formats, and user-specific guidelines. Maintain consistency throughout your response.]';
      
      const finalUserMessage = buildChatMessage(
        'user',
        content + instruction,
        attachments,
        modelSupportsVision
      );
      chatHistory.push(finalUserMessage);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

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

      console.log('[STREAMING] Starting stream...');
      let chunkCount = 0;
      
      for await (const chunk of chatApi.streamChat(chatHistory, abortController.signal)) {
        chunkCount++;
        console.log(`[STREAMING] Chunk #${chunkCount}:`, chunk);
        
        if (abortController.signal.aborted) {
          console.log('[STREAMING] Aborted signal received, breaking stream');
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
            chatHistory,
            messagesToSend,
            content
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

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: `Error: ${errorMessage}` }
            : msg
        )
      );
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
