import { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { chatApi } from '../services/chat-api';
import { getSystemPrompt } from '../utils/prompts';
import { useWorkspaceContext } from './use-workspace-context';
import type { Message } from '../types/chat';
import type { ChatMessage } from '../types/chat-api';
import { hasCompleteToolBlock, extractToolBlocks } from '../lib/tool-parser';
import { ToolExecutor } from '../lib/tool-executor';
import { getAllTools } from '../lib/tool-registry';
import type { ToolExecutionState } from '../types/tool';
import { createToolExecutionState, updateToolExecutionStatus, generateToolExecutionId } from '../lib/tool-execution-tracker';

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
        window.workspaceContext = event.data.workspace;
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
  const [isExecutingTool, setIsExecutingTool] = useState(false);
  const workspace = useWorkspaceContext();
  const abortControllerRef = useRef<AbortController | null>(null);
  const sendingMessageRef = useRef(false);
  const isStreamingRef = useRef(false);
  const isStoppingRef = useRef(false);

  // Initialize tool executor with enabled tools
  const toolExecutorRef = useRef<ToolExecutor | null>(null);
  if (!toolExecutorRef.current) {
    const enabledTools = getAllTools(false).map(t => t.id);
    toolExecutorRef.current = new ToolExecutor({
      enabledTools,
      isStoppingRef,
    });
  }

  const updateMessage = useCallback((messageId: string, newContent: string) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId
          ? { ...msg, content: newContent }
          : msg
      )
    );
  }, []);

  /**
   * Update tool execution state for a specific message
   */
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

  const sendMessage = useCallback(async (content: string, overrideMessages?: Message[]) => {
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
        
        // Check for complete tool block
        if (hasCompleteToolBlock(assistantContent)) {
          // Update UI with current content
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
  }, [messages, workspace]);

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

  /**
   * Execute tool and continue chat with results
   */
  const executeToolAndContinue = useCallback(
    async (
      assistantContent: string,
      assistantMessageId: string,
      _previousHistory: ChatMessage[],
      messagesToSend: Message[],
      userContent: string,
      toolIndex = 0,
    ) => {
      if (!toolExecutorRef.current) {return;}
      
      try {
        // Keep executing tool state active
        setIsExecutingTool(true);
        
        // Extract all tool blocks and get the current one by index
        const toolBlocks = extractToolBlocks(assistantContent);
        const toolBlock = toolBlocks[toolIndex];
        
        if (!toolBlock) {
          setIsExecutingTool(false);
          return;
        }
        
        // Generate tool execution ID with correct index
        const toolExecutionId = generateToolExecutionId(assistantMessageId, toolIndex);
        
        console.log('[Tool] Executing tool:', toolBlock.toolName, 'ID:', toolExecutionId);
        
        // Create initial execution state with "executing" status
        const executionState = createToolExecutionState(
          toolExecutionId,
          toolBlock.toolName,
          toolBlock.parameters
        );
        
        // Update UI with executing status
        updateToolExecution(assistantMessageId, toolExecutionId, executionState);
        
        // Check if stopped before execution
        if (isStoppingRef.current) {
          const abortedState = updateToolExecutionStatus(executionState, 'aborted', {
            success: false,
            error: 'Stopped by user'
          });
          updateToolExecution(assistantMessageId, toolExecutionId, abortedState);
          setIsExecutingTool(false);
          return;
        }
        
        // Execute the specific tool directly
        let result;
        try {
          const toolResult = await toolExecutorRef.current.execute({
            toolName: toolBlock.toolName,
            parameters: toolBlock.parameters,
            status: 'executing'
          });

          // Check if stopped during execution
          if (isStoppingRef.current) {
            result = {
              executedToolCalls: [{
                toolName: toolBlock.toolName,
                parameters: toolBlock.parameters,
                status: 'aborted' as const,
                result: { success: false, error: 'Stopped by user' }
              }],
              toolResults: [],
              wasStopped: true
            };
          } else {
            result = {
              executedToolCalls: [{
                toolName: toolBlock.toolName,
                parameters: toolBlock.parameters,
                status: toolResult.success ? ('completed' as const) : ('error' as const),
                result: toolResult
              }],
              toolResults: [
                toolResult.success 
                  ? `Tool: ${toolBlock.toolName}\nResult: ${JSON.stringify(toolResult.data, null, 2)}`
                  : `Tool: ${toolBlock.toolName}\nError: ${toolResult.error}`
              ],
              wasStopped: false
            };
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result = {
            executedToolCalls: [{
              toolName: toolBlock.toolName,
              parameters: toolBlock.parameters,
              status: 'error' as const,
              result: { success: false, error: errorMessage }
            }],
            toolResults: [`Tool: ${toolBlock.toolName}\nError: ${errorMessage}`],
            wasStopped: false
          };
        }
        
        if (result.wasStopped) {
          // Update to aborted status
          const abortedState = updateToolExecutionStatus(executionState, 'aborted', {
            success: false,
            error: 'Stopped by user'
          });
          updateToolExecution(assistantMessageId, toolExecutionId, abortedState);
          setIsExecutingTool(false);
          return;
        }
        
        if (result.executedToolCalls.length === 0) {
          setIsExecutingTool(false);
          return;
        }
        
        // Get the execution result from tool executor
        const executedTool = result.executedToolCalls[0];
        if (executedTool) {
          // Update to completed or error status based on result
          const finalState = updateToolExecutionStatus(
            executionState,
            executedTool.status,
            executedTool.result
          );
          updateToolExecution(assistantMessageId, toolExecutionId, finalState);
        }
        
        // Format tool results for AI context
        const toolResultText = result.toolResults.join('\n\n');
        
        // Continue chat with tool results
        const latestWorkspace = window.workspaceContext || workspace;
        const systemPrompt = getSystemPrompt(latestWorkspace);
        
        const continuationHistory: ChatMessage[] = [
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
            content: userContent,
          },
          {
            role: 'assistant',
            content: assistantContent,
          },
          {
            role: 'user',
            content: `Tool execution results:\n${toolResultText}`,
          },
        ];
        
        // Continue streaming - clear executing tool state
        setIsExecutingTool(false);
        
        const newAbortController = new AbortController();
        abortControllerRef.current = newAbortController;
        
        let continuationContent = assistantContent;
        let pendingUpdate = false;
        
        const updateUI = () => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: continuationContent }
                : msg
            )
          );
          pendingUpdate = false;
        };
        
        for await (const chunk of chatApi.streamChat(
          continuationHistory,
          newAbortController.signal
        )) {
          if (newAbortController.signal.aborted) {
            break;
          }
          
          continuationContent += chunk;
          
          // Check for another tool block
          if (hasCompleteToolBlock(continuationContent.slice(assistantContent.length))) {
            // Update UI
            if (pendingUpdate) {
              updateUI();
            } else {
              updateUI();
            }
            
            // Abort and execute next tool
            newAbortController.abort();
            setIsExecutingTool(true);
            await executeToolAndContinue(
              continuationContent,
              assistantMessageId,
              continuationHistory,
              messagesToSend,
              userContent,
              toolIndex + 1
            );
            return;
          }
          
          if (!pendingUpdate) {
            pendingUpdate = true;
            requestAnimationFrame(updateUI);
          }
        }
        
        // Final update
        if (pendingUpdate) {
          updateUI();
        }
      } catch (error) {
        console.error('[Tool] Execution error:', error);
        
        // Try to extract tool info for error state update
        const toolBlocks = extractToolBlocks(assistantContent);
        const toolBlock = toolBlocks[toolIndex];
        if (toolBlock) {
          const toolExecutionId = generateToolExecutionId(assistantMessageId, toolIndex);
          const errorState: ToolExecutionState = {
            toolExecutionId,
            toolName: toolBlock.toolName,
            parameters: toolBlock.parameters,
            status: 'error',
            result: {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            },
            startedAt: Date.now(),
            completedAt: Date.now(),
          };
          updateToolExecution(assistantMessageId, toolExecutionId, errorState);
        }
      } finally {
        setIsExecutingTool(false);
        isStreamingRef.current = false;
        setIsStreaming(false);
        abortControllerRef.current = null;
        sendingMessageRef.current = false;
      }
    },
    [workspace, updateToolExecution],
  );

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