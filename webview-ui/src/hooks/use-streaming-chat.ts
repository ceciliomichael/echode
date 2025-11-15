import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { nvidiaApi } from '../services/nvidia-api';
import { getSystemPrompt } from '../utils/prompts';
import { useWorkspaceContext } from './use-workspace-context';
import type { Message } from '../types/chat';
import type { ChatMessage } from '../types/nvidia-api';

export function useStreamingChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const workspace = useWorkspaceContext();

  const updateMessage = useCallback((messageId: string, newContent: string) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId
          ? { ...msg, content: newContent }
          : msg
      )
    );
  }, []);

  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    setMessages(prev => prev.slice(0, messageIndex));
    await sendMessage(newContent);
  }, [messages]);

  const sendMessage = useCallback(async (content: string) => {
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);

    const assistantMessageId = uuidv4();
    let assistantContent = '';

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

      for await (const chunk of nvidiaApi.streamChat(chatHistory)) {
        assistantContent += chunk;
        
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: assistantContent }
              : msg
          )
        );
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
      setIsStreaming(false);
    }
  }, [messages]);

  return {
    messages,
    isStreaming,
    sendMessage,
    editMessage,
    updateMessage,
  };
}