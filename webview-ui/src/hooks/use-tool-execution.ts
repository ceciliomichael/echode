import { useCallback, useRef } from 'react';
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

interface ToolExecutionHookProps {
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsExecutingTool: React.Dispatch<React.SetStateAction<boolean>>;
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  isStreamingRef: React.MutableRefObject<boolean>;
  isStoppingRef: React.MutableRefObject<boolean>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  sendingMessageRef: React.MutableRefObject<boolean>;
  updateToolExecution: (messageId: string, toolExecutionId: string, state: ToolExecutionState) => void;
}

export function useToolExecution({
  setMessages,
  setIsExecutingTool,
  setIsStreaming,
  isStreamingRef,
  isStoppingRef,
  abortControllerRef,
  sendingMessageRef,
  updateToolExecution,
}: ToolExecutionHookProps) {
  const workspace = useWorkspaceContext();

  // Initialize tool executor with enabled tools
  const toolExecutorRef = useRef<ToolExecutor | null>(null);
  if (!toolExecutorRef.current) {
    const enabledTools = getAllTools(false).map(t => t.id);
    toolExecutorRef.current = new ToolExecutor({
      enabledTools,
      isStoppingRef,
    });
  }

  const executeToolAndContinue = useCallback(
    async (
      assistantContent: string,
      assistantMessageId: string,
      _previousHistory: ChatMessage[],
      messagesToSend: Message[],
      userContent: string,
      toolIndex = 0,
    ) => {
      if (!toolExecutorRef.current) return;
      
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
            content: `Tool execution results:\n${toolResultText}\n\n[SYSTEM REMINDER: Follow all system instructions as stated in your system prompt. Adhere to the specified guidelines, formats, and protocols provided throughout.]`,
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
          
          // Log chunk for debugging
          console.debug('[Stream Continuation]', JSON.stringify(chunk));

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
    [workspace, updateToolExecution, setMessages, setIsExecutingTool, setIsStreaming, isStreamingRef, isStoppingRef, abortControllerRef, sendingMessageRef],
  );

  return { executeToolAndContinue };
}
