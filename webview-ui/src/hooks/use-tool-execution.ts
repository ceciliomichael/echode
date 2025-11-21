import { useCallback, useRef } from 'react';
import { chatApi } from '../services/chat-api';
import { getSystemPrompt } from '../utils/prompts';
import { useWorkspaceContext } from './use-workspace-context';
import type { Message } from '../types/chat';
import type { ChatMessage } from '../types/chat-api';
import { hasCompleteToolBlock, extractToolBlocks, trimToFirstCompleteToolBlock } from '../lib/tool-parser';
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
  messagesRef: React.MutableRefObject<Message[]>;
  currentTodos?: Array<{ id: string; content: string; status: string }>;
  saveSession: () => void;
}

export function useToolExecution({
  setMessages,
  setIsExecutingTool,
  setIsStreaming,
  isStreamingRef,
  isStoppingRef,
  abortControllerRef,
  sendingMessageRef,
  messagesRef,
  updateToolExecution,
  currentTodos = [],
  saveSession,
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
        
        // Create initial execution state (executing immediately)
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
            // Normal tool result
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
          // Update tool execution state
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
        ];
        
        // Get CURRENT messages from ref (not stale parameter)
        const currentMessages = messagesRef.current;
        
        // Add previous messages WITH their tool results
        for (const msg of currentMessages) {
          continuationHistory.push({
            role: msg.role,
            content: msg.content,
          });
          
          // Include previous tool execution results
          if (msg.toolExecutions && msg.toolExecutions.size > 0) {
            const toolResults: string[] = [];
            msg.toolExecutions.forEach((execution) => {
              if (execution.status === 'completed' && execution.result) {
                if (execution.result.success) {
                  const data = execution.result.data as Record<string, unknown>;
                  let formattedResult = '';
                  
                  if (execution.toolName === 'read_file') {
                    formattedResult = `File: ${data.path as string}\n${data.content as string}`;
                  } else if (execution.toolName === 'grep_search') {
                    formattedResult = `Query: ${data.query as string}\nFound ${data.totalMatches as number} matches in ${data.filesWithMatches as number} files`;
                    if (data.results && Array.isArray(data.results) && data.results.length > 0) {
                      formattedResult += '\n' + data.results.slice(0, 5).map((r: Record<string, unknown>) => 
                        `${r.file as string}: ${(r.matches as unknown[]).length} matches`
                      ).join('\n');
                    }
                  } else if (execution.toolName === 'list_files') {
                    const directories = data.directories as Array<{ name: string }> | undefined;
                    const files = data.files as Array<{ name: string }> | undefined;
                    formattedResult = `Directory: ${data.path as string}\nDirectories: ${directories?.map(d => d.name).join(', ') || 'none'}\nFiles: ${files?.map(f => f.name).join(', ') || 'none'}`;
                  } else {
                    formattedResult = JSON.stringify(data);
                  }
                  
                  toolResults.push(`[${execution.toolName}]\n${formattedResult}`);
                } else {
                  toolResults.push(`[${execution.toolName} ERROR]\n${execution.result.error}`);
                }
              }
            });
            
            if (toolResults.length > 0) {
              continuationHistory.push({
                role: 'user',
                content: `<previous_tool_results>\n${toolResults.join('\n\n---\n\n')}\n</previous_tool_results>`,
              });
            }
          }
        }
        
        // Add current user message and assistant response
        continuationHistory.push({
          role: 'user',
          content: userContent,
        });
        continuationHistory.push({
          role: 'assistant',
          content: assistantContent,
        });
        
        // Add current todo list context if exists and has incomplete tasks
        let todoContext = '';
        if (currentTodos.length > 0) {
          const pendingTasks = currentTodos.filter(t => t.status === 'pending').map(t => `- ${t.content}`).join('\n');
          const inProgressTasks = currentTodos.filter(t => t.status === 'in_progress').map(t => `- ${t.content}`).join('\n');
          const completedTasks = currentTodos.filter(t => t.status === 'completed').map(t => `- ${t.content}`).join('\n');
          
          // Only send todo context if there are incomplete tasks
          const hasIncompleteTasks = pendingTasks || inProgressTasks;
          
          if (hasIncompleteTasks) {
            todoContext = '\n\n<current_todo_list>\n';
            if (pendingTasks) todoContext += `Pending:\n${pendingTasks}\n\n`;
            if (inProgressTasks) todoContext += `In Progress:\n${inProgressTasks}\n\n`;
            if (completedTasks) todoContext += `Completed:\n${completedTasks}\n`;
            todoContext += '</current_todo_list>\n\n[INSTRUCTION: The current todo list is provided above. Keep track of task progress and update the todo list using the todo_write tool when tasks are completed or new tasks need to be added. Always maintain the todo list to reflect the current state of work.]';
          }
        }
        
        // Add the CURRENT tool execution result
        continuationHistory.push({
          role: 'user',
          content: `Tool execution results:\n${toolResultText}${todoContext}\n\n[INSTRUCTION: Process these tool results and continue your response. You have access to previous tool results in <previous_tool_results> tags. Maintain all system prompt rules, tool protocols, and formatting requirements. Stay focused on the original user request.]`,
        });
        
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
          
          // Check for another tool block in the new content only
          const newContent = continuationContent.slice(assistantContent.length);
          if (hasCompleteToolBlock(newContent)) {
            // Trim the entire continuation content to only include up to the first complete tool block
            // This ensures we execute tools strictly one-by-one
            const trimmedContinuation = assistantContent + trimToFirstCompleteToolBlock(newContent);
            continuationContent = trimmedContinuation;
            
            // Update UI with trimmed content before interrupting
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
        
        // Save session after tool execution completion
        saveSession();
      }
    },
    [workspace, updateToolExecution, setMessages, setIsExecutingTool, setIsStreaming, isStreamingRef, isStoppingRef, abortControllerRef, sendingMessageRef, currentTodos, messagesRef, saveSession],
  );

  return { executeToolAndContinue };
}
