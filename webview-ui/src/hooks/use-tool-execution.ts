import { useCallback, useRef, useEffect } from 'react';
import { chatApi } from '../services/chat-api';
import { useWorkspaceContext } from './use-workspace-context';
import type { Message } from '../types/chat';
import type { ChatMessage } from '../types/chat-api';
import type { ChatMode } from '../types/chat-mode';
import { hasCompleteToolBlock, extractToolBlocks, trimToFirstCompleteToolBlock, extractParallelizableToolBlocks } from '../lib/tool-parser';
import { ToolExecutor } from '../lib/tool-executor';
import { getToolsForMode } from '../lib/tool-config';
import type { ToolExecutionState } from '../types/tool';
import { createToolExecutionState, updateToolExecutionStatus, generateToolExecutionId } from '../lib/tool-execution-tracker';
import { fetchDiagnostics, formatDiagnosticsForAI, shouldFetchDiagnostics, isFileModificationTool as checkIsFileModificationTool } from '../utils/diagnostic-utils';
import { buildContinuationHistory } from '../utils/continuation-builder';
import { executeToolWithStopCheck } from '../utils/tool-execution-helpers';

/**
 * Helper to fetch and format diagnostics for a tool execution
 */
async function fetchAndFormatDiagnostics(
  executedTool: { toolName: string; result?: { success: boolean; data?: unknown } } | undefined,
  completedState: ToolExecutionState,
  assistantMessageId: string,
  toolExecutionId: string,
  updateToolExecution: (messageId: string, toolExecutionId: string, state: ToolExecutionState) => void,
  diagnosticAttemptsRef: React.MutableRefObject<Record<string, number>>
): Promise<string> {
  if (!executedTool?.result?.success || !('data' in executedTool.result) || !executedTool.result.data) {
    return '';
  }

  const data = executedTool.result.data as Record<string, unknown>;
  const filePath = (data.path as string) || 'unknown';
  const absolutePath = data.absolutePath as string;

  if (!shouldFetchDiagnostics(executedTool.toolName) || !absolutePath) {
    return '';
  }

  // Update status to fetching_diagnostics
  const fetchingState = { ...completedState, status: 'fetching_diagnostics' as const };
  updateToolExecution(assistantMessageId, toolExecutionId, fetchingState);

  console.log(`[ToolExecution] Fetching diagnostics for ${filePath}...`);

  // Fetch diagnostics from backend
  const diagnostics = await fetchDiagnostics(filePath, absolutePath);

  // Update state with diagnostics
  const finalState = { ...completedState, diagnostics };
  updateToolExecution(assistantMessageId, toolExecutionId, finalState);

  // Handle diagnostic results
  if (diagnostics && diagnostics.length > 0) {
    const isModificationTool = checkIsFileModificationTool(executedTool.toolName);
    const maxIterations = 3;
    
    if (isModificationTool) {
      const currentAttempts = (diagnosticAttemptsRef.current[filePath] || 0) + 1;
      diagnosticAttemptsRef.current[filePath] = currentAttempts;
      return formatDiagnosticsForAI(diagnostics, filePath, isModificationTool, currentAttempts, maxIterations);
    }
    
    return formatDiagnosticsForAI(diagnostics, filePath, isModificationTool, 0, maxIterations);
  } else {
    // No diagnostics found - reset attempts counter
    if (diagnosticAttemptsRef.current[filePath]) {
      console.log(`[Diagnostics] No errors found for ${filePath} - resetting attempt counter`);
      delete diagnosticAttemptsRef.current[filePath];
    }
    return '';
  }
}

/**
 * Fetch diagnostics for multiple files in parallel
 */
async function fetchAndFormatDiagnosticsParallel(
  executedTools: Array<{ toolName: string; result?: { success: boolean; data?: unknown }; state: ToolExecutionState }>,
  assistantMessageId: string,
  updateToolExecution: (messageId: string, toolExecutionId: string, state: ToolExecutionState) => void,
  diagnosticAttemptsRef: React.MutableRefObject<Record<string, number>>
): Promise<string[]> {
  console.log(`[ToolExecution] Fetching diagnostics for ${executedTools.length} files in parallel...`);
  
  const diagnosticsPromises = executedTools.map(async ({ toolName, result, state }) => {
    if (!result?.success || !('data' in result) || !result.data) {
      return '';
    }

    const data = result.data as Record<string, unknown>;
    const filePath = (data.path as string) || 'unknown';
    const absolutePath = data.absolutePath as string;

    if (!shouldFetchDiagnostics(toolName) || !absolutePath) {
      return '';
    }

    // Update status to fetching_diagnostics
    const fetchingState = { ...state, status: 'fetching_diagnostics' as const };
    updateToolExecution(assistantMessageId, state.toolExecutionId, fetchingState);

    // Fetch diagnostics from backend
    const diagnostics = await fetchDiagnostics(filePath, absolutePath);

    // Update state with diagnostics
    const finalState = { ...state, diagnostics };
    updateToolExecution(assistantMessageId, state.toolExecutionId, finalState);

    // Handle diagnostic results
    if (diagnostics && diagnostics.length > 0) {
      const isModificationTool = checkIsFileModificationTool(toolName);
      const maxIterations = 3;
      
      if (isModificationTool) {
        const currentAttempts = (diagnosticAttemptsRef.current[filePath] || 0) + 1;
        diagnosticAttemptsRef.current[filePath] = currentAttempts;
        return formatDiagnosticsForAI(diagnostics, filePath, isModificationTool, currentAttempts, maxIterations);
      }
      
      return formatDiagnosticsForAI(diagnostics, filePath, isModificationTool, 0, maxIterations);
    } else {
      // No diagnostics found - reset attempts counter
      if (diagnosticAttemptsRef.current[filePath]) {
        console.log(`[Diagnostics] No errors found for ${filePath} - resetting attempt counter`);
        delete diagnosticAttemptsRef.current[filePath];
      }
      return '';
    }
  });

  const results = await Promise.all(diagnosticsPromises);
  console.log(`[ToolExecution] Completed parallel diagnostics fetch for ${executedTools.length} files`);
  return results.filter(r => r.length > 0);
}

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
  mode: ChatMode;
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
  mode,
}: ToolExecutionHookProps) {
  const workspace = useWorkspaceContext();

  // Track diagnostic fix attempts per file to prevent infinite loops
  const diagnosticAttemptsRef = useRef<Record<string, number>>({});

  // Initialize tool executor with mode-aware enabled tools
  const toolExecutorRef = useRef<ToolExecutor | null>(null);
  
  // Recreate tool executor when mode changes to refresh enabled tools
  useEffect(() => {
    const enabledTools = getToolsForMode(mode, false).map(t => t.id);
    toolExecutorRef.current = new ToolExecutor({
      enabledTools,
      isStoppingRef,
      mode,
    });
  }, [mode, isStoppingRef]);

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
        
        // Check if we can execute multiple tools in parallel
        // Only execute in parallel if we're at the first tool and there are consecutive parallelizable tools
        const shouldExecuteInParallel = toolIndex === 0;
        const parallelizableBlocks = shouldExecuteInParallel ? extractParallelizableToolBlocks(assistantContent) : [];
        const canExecuteInParallel = parallelizableBlocks.length > 1;
        
        if (canExecuteInParallel) {
          console.log(`[ToolExecution] Detected ${parallelizableBlocks.length} parallelizable tools, executing in parallel...`);
          
          // Create execution states for all parallel tools
          const executionStates = parallelizableBlocks.map((block, idx) => {
            const execId = generateToolExecutionId(assistantMessageId, idx);
            const state = createToolExecutionState(
              execId,
              block.toolName,
              block.parameters
            );
            updateToolExecution(assistantMessageId, execId, state);
            return { block, state, execId };
          });
          
          // Check if stopped before execution
          if (isStoppingRef.current) {
            executionStates.forEach(({ state, execId }) => {
              const abortedState = updateToolExecutionStatus(state, 'aborted', {
                success: false,
                error: 'Stopped by user'
              });
              updateToolExecution(assistantMessageId, execId, abortedState);
            });
            setIsExecutingTool(false);
            return;
          }
          
          // Execute all tools in parallel using the tool executor
          const parallelResult = await toolExecutorRef.current.executeToolBlocksInParallel(parallelizableBlocks);
          
          if (parallelResult.wasStopped) {
            executionStates.forEach(({ state, execId }) => {
              const abortedState = updateToolExecutionStatus(state, 'aborted', {
                success: false,
                error: 'Stopped by user'
              });
              updateToolExecution(assistantMessageId, execId, abortedState);
            });
            setIsExecutingTool(false);
            return;
          }
          
          // Update all tool execution states with results
          const completedStates = parallelResult.executedToolCalls.map((executedTool, idx) => {
            const { state, execId } = executionStates[idx];
            const completedState = updateToolExecutionStatus(
              state,
              executedTool.status,
              executedTool.result
            );
            updateToolExecution(assistantMessageId, execId, completedState);
            return { toolName: executedTool.toolName, result: executedTool.result, state: completedState };
          });
          
          // Fetch diagnostics in parallel for all modified files
          const diagnosticsTexts = await fetchAndFormatDiagnosticsParallel(
            completedStates,
            assistantMessageId,
            updateToolExecution,
            diagnosticAttemptsRef
          );
          
          // Format tool results for AI context
          const toolResultText = parallelResult.toolResults.join('\n\n');
          const diagnosticsText = diagnosticsTexts.join('\n\n');
          
          // Build continuation history for chat
          const latestWorkspace = (window.workspaceContext || workspace)!;
          const continuationHistory = buildContinuationHistory(
            latestWorkspace,
            messagesRef.current,
            userContent,
            assistantContent,
            toolResultText,
            diagnosticsText,
            currentTodos,
            mode
          );
          
          // Continue streaming with results from parallel execution
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
              const trimmedContinuation = assistantContent + trimToFirstCompleteToolBlock(newContent);
              continuationContent = trimmedContinuation;
              
              if (pendingUpdate) {
                updateUI();
              } else {
                updateUI();
              }
              
              // Abort and execute next tool (starting from the index after parallel batch)
              newAbortController.abort();
              setIsExecutingTool(true);
              await executeToolAndContinue(
                continuationContent,
                assistantMessageId,
                continuationHistory,
                messagesToSend,
                userContent,
                parallelizableBlocks.length // Continue from after the parallel batch
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
          
          return; // Exit after parallel execution
        }
        
        // Single tool execution path (existing logic)
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
        const result = await executeToolWithStopCheck(
          toolExecutorRef.current,
          toolBlock,
          isStoppingRef
        );
        
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
        let completedState = executionState;
        if (executedTool) {
          // Update tool execution state with result - show in dropdown immediately
          completedState = updateToolExecutionStatus(
            executionState,
            executedTool.status,
            executedTool.result
          );
          updateToolExecution(assistantMessageId, toolExecutionId, completedState);
        }
        
        // Check if this is a planning tool that requires user interaction
        const isPlanningTool = toolBlock.toolName === 'plan_navigator' || toolBlock.toolName === 'plan_handoff';
        
        if (isPlanningTool) {
          // Stop execution here - wait for user to interact with the tool
          setIsExecutingTool(false);
          return;
        }
        
        // Format tool results for AI context
        const toolResultText = result.toolResults.join('\n\n');
        
        // Fetch diagnostics after showing result
        const diagnosticsText = await fetchAndFormatDiagnostics(
          executedTool,
          completedState,
          assistantMessageId,
          toolExecutionId,
          updateToolExecution,
          diagnosticAttemptsRef
        );
        
        // Build continuation history for chat
        const latestWorkspace = (window.workspaceContext || workspace)!;
        const continuationHistory = buildContinuationHistory(
          latestWorkspace,
          messagesRef.current,
          userContent,
          assistantContent,
          toolResultText,
          diagnosticsText,
          currentTodos,
          mode
        );
        
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
    [workspace, updateToolExecution, setMessages, setIsExecutingTool, setIsStreaming, isStreamingRef, isStoppingRef, abortControllerRef, sendingMessageRef, currentTodos, messagesRef, saveSession, mode],
  );

  return { executeToolAndContinue };
}
