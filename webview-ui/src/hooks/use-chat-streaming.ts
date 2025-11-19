import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { chatApi } from '../services/chat-api';
import { getSystemPrompt } from '../utils/prompts';
import { requestWorkspaceInfo } from '../utils/workspace-info';
import { useWorkspaceContext } from './use-workspace-context';
import type { Message } from '../types/chat';
import type { ChatMessage } from '../types/chat-api';
import { hasCompleteToolBlock, trimToFirstCompleteToolBlock } from '../lib/tool-parser';

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
}: ChatStreamingProps) {
  const workspace = useWorkspaceContext();

  const sendMessage = useCallback(async (content: string, overrideMessages?: Message[]) => {
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
    };
    setMessages((prev) => [...prev, userMessage]);

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
      const systemPrompt = getSystemPrompt(latestWorkspace);
      
      // Use override messages if provided (for edit flow), otherwise use current messages
      const messagesToSend = overrideMessages !== undefined ? overrideMessages : messages;
      
      const chatHistory: ChatMessage[] = [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...messagesToSend.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        {
          role: 'user',
          content: content + '\n\n[SYSTEM REMINDER: Follow all system instructions as stated in your system prompt. Adhere to the specified guidelines, formats, and protocols provided throughout.]',
        },
      ];

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

      for await (const chunk of chatApi.streamChat(chatHistory, abortController.signal)) {
        if (abortController.signal.aborted) {
          break;
        }

        // Log chunk for debugging
        console.debug('[Stream]', JSON.stringify(chunk));

        assistantContent += chunk;
        
        // Check for complete tool block
        if (hasCompleteToolBlock(assistantContent)) {
          // Trim content to only include up to the end of the FIRST complete tool block
          // This ensures we execute tools strictly one-by-one and don't include partial content
          const trimmedContent = trimToFirstCompleteToolBlock(assistantContent);
          assistantContent = trimmedContent;
          
          // Update UI with trimmed content before interrupting
          if (pendingUpdate) {
            updateUI();
          } else {
            updateUI();
          }
          
          // Abort stream to execute tool
          abortController.abort();
          
          // Set executing tool state to show loading
          setIsExecutingTool(true);
          
          // Execute tool and continue
          await executeToolAndContinue(
            assistantContent,
            assistantMessageId,
            chatHistory,
            messagesToSend,
            content
          );
          
          return; // Exit early, tool execution will handle continuation
        }
        
        // Batch updates: only update UI every 16ms (60fps) for smooth performance
        if (!pendingUpdate) {
          pendingUpdate = true;
          requestAnimationFrame(updateUI);
        }
      }
      
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
    }
  }, [messages, workspace, executeToolAndContinue, setMessages, setIsStreaming, setIsExecutingTool, isStreamingRef, sendingMessageRef, abortControllerRef]);

  return { sendMessage };
}
