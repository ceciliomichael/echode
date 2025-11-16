import { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { chatApi } from '../services/chat-api';
import { getSystemPrompt } from '../utils/prompts';
import { useWorkspaceContext } from './use-workspace-context';
import type { Message } from '../types/chat';
import type { ChatMessage } from '../types/chat-api';

/**
 * Request fresh workspace info from extension and wait for response
 */
function requestWorkspaceInfo(): Promise<void> {
  return new Promise((resolve) => {
    if (!window.vscode) {
      resolve();
      return;
    }

    const handler = (event: MessageEvent) => {
      if (event.data.type === 'workspaceInfo') {
        window.removeEventListener('message', handler);
        resolve();
      }
    };

    window.addEventListener('message', handler);
    window.vscode.postMessage({ type: 'requestWorkspaceInfo' });

    // Timeout fallback after 500ms
    setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve();
    }, 500);
  });
}

export function useStreamingChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const workspace = useWorkspaceContext();
  const abortControllerRef = useRef<AbortController | null>(null);
  const sendingMessageRef = useRef(false);
  const isStreamingRef = useRef(false);

  const updateMessage = useCallback((messageId: string, newContent: string) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId
          ? { ...msg, content: newContent }
          : msg
      )
    );
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    // Prevent starting new stream if already streaming
    // Use ref for immediate check, not state which updates asynchronously
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
    let assistantMessageId: string;
    let assistantContent = '';
    let pendingUpdate = false;
    
    assistantMessageId = uuidv4();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const systemPrompt = getSystemPrompt(workspace);
      
      const chatHistory: ChatMessage[] = [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        {
          role: 'user',
          content,
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

        assistantContent += chunk;
        
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
  }, [messages, workspace]);

  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) {return;}

    // Step 1: Abort any ongoing API call
    if (abortControllerRef.current) {
      console.log('Aborting ongoing stream before edit');
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      isStreamingRef.current = false;
      setIsStreaming(false);
      sendingMessageRef.current = false;
    }

    // Step 2: Clear all messages subsequent to the one being resent
    setMessages(prev => prev.slice(0, messageIndex));

    // Step 3: Send the new message
    await sendMessage(newContent);
  }, [messages, sendMessage]);

  const clearChat = useCallback(() => {
    setMessages([]);
  }, []);

  const abortStream = useCallback(() => {
    if (abortControllerRef.current) {
      console.log('Aborting stream');
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      // Immediately set streaming to false (both ref and state)
      isStreamingRef.current = false;
      setIsStreaming(false);
      // Reset sending flag to allow next message
      sendingMessageRef.current = false;
    }
  }, []);

  return {
    messages,
    isStreaming,
    sendMessage,
    editMessage,
    updateMessage,
    clearChat,
    abortStream,
  };
}