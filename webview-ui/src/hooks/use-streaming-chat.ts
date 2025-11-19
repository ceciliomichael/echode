import { useState, useCallback, useRef } from 'react';
import type { Message } from '../types/chat';
import type { ToolExecutionState } from '../types/tool';
import { useToolExecution } from './use-tool-execution';
import { useChatStreaming } from './use-chat-streaming';

export function useStreamingChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isExecutingTool, setIsExecutingTool] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sendingMessageRef = useRef(false);
  const isStreamingRef = useRef(false);
  const isStoppingRef = useRef(false);

  const updateMessage = useCallback((messageId: string, newContent: string) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId
          ? { ...msg, content: newContent }
          : msg
      )
    );
  }, []);

  const updateToolExecution = useCallback((messageId: string, toolExecutionId: string, state: ToolExecutionState) => {
    setMessages(prev =>
      prev.map(msg => {
        if (msg.id === messageId) {
          const toolExecutions = new Map(msg.toolExecutions || []);
          toolExecutions.set(toolExecutionId, state);
          return { ...msg, toolExecutions };
        }
        return msg;
      })
    );
  }, []);

  // Tool execution hook
  const { executeToolAndContinue } = useToolExecution({
    setMessages,
    setIsExecutingTool,
    setIsStreaming,
    isStreamingRef,
    isStoppingRef,
    abortControllerRef,
    sendingMessageRef,
    updateToolExecution,
  });

  // Chat streaming hook
  const { sendMessage } = useChatStreaming({
    messages,
    setMessages,
    setIsStreaming,
    setIsExecutingTool,
    isStreamingRef,
    sendingMessageRef,
    abortControllerRef,
    executeToolAndContinue,
  });

  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) {return;}

    // Step 1: Abort any ongoing API call and wait for cleanup
    if (abortControllerRef.current) {
      console.log('[Chat] Aborting ongoing stream before edit');
      isStoppingRef.current = true; // Signal stopping to prevent further execution loops
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      
      // Wait briefly for the stream to finish cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Reset stopping flag
    isStoppingRef.current = false;
    isStreamingRef.current = false;
    setIsStreaming(false);
    setIsExecutingTool(false);
    sendingMessageRef.current = false;
    
    // Step 2: Get truncated message history (everything before the edited message)
    const truncatedMessages = messages.slice(0, messageIndex);
    
    // Step 3: Clear all messages subsequent to the one being edited
    setMessages(truncatedMessages);

    // Step 4: Send the new message with explicit message history to avoid stale closure
    await sendMessage(newContent, truncatedMessages);
  }, [messages, sendMessage]);

  const clearChat = useCallback(() => {
    setMessages([]);
  }, []);

  const abortStream = useCallback(() => {
    if (abortControllerRef.current) {
      console.log('Aborting stream');
      isStoppingRef.current = true;
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      // Immediately set streaming to false (both ref and state)
      isStreamingRef.current = false;
      setIsStreaming(false);
      // Reset sending flag to allow next message
      sendingMessageRef.current = false;
      isStoppingRef.current = false;
    }
  }, []);

  return {
    messages,
    isStreaming,
    isExecutingTool,
    sendMessage,
    editMessage,
    updateMessage,
    clearChat,
    abortStream,
  };
}