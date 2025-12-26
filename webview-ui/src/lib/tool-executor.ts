import type { ToolCall, ToolExecutionResult } from '../types/tool';
import { getToolHandler, type ToolStatusCallback, type ToolProgressCallback, isToolRegistered } from './tool-registry';
import { extractFirstToolBlock } from './tool-parser';
import { type ChatMode, executeToolViaExtension } from './tool-utils';
import type { PlanToolResult } from './tools/plan-tool';

/**
 * Check if a tool is an MCP (Model Context Protocol) tool
 * MCP tools are prefixed with 'mcp_' and are handled by the extension backend
 */
function isMcpTool(toolName: string): boolean {
  return toolName.startsWith('mcp_');
}

export interface ToolCallExecutionResult {
  executedToolCalls: Array<{
    toolName: string;
    parameters: Record<string, unknown>;
    status: 'pending' | 'executing' | 'completed' | 'error' | 'aborted';
    result?: ToolExecutionResult;
  }>;
  toolResults: string[];
  wasStopped: boolean;
}

export interface ToolExecutorOptions {
  enabledTools: string[];
  isStoppingRef: { current: boolean };
  abortControllerRef?: { current: AbortController | null };
  mode?: ChatMode;
}

export class ToolExecutor {
  private enabledTools: string[];
  private isStoppingRef: { current: boolean };
  private abortControllerRef?: { current: AbortController | null };
  public readonly mode?: ChatMode;

  constructor(options: ToolExecutorOptions) {
    this.enabledTools = options.enabledTools;
    this.isStoppingRef = options.isStoppingRef;
    this.abortControllerRef = options.abortControllerRef;
    this.mode = options.mode;
  }

  /**
   * Get the current abort signal from the abort controller ref
   */
  private getAbortSignal(): AbortSignal | undefined {
    return this.abortControllerRef?.current?.signal;
  }

  /**
   * Execute tool call
   */
  async execute(
    toolCall: ToolCall,
    signal?: AbortSignal,
    onStatusChange?: ToolStatusCallback,
    onProgress?: ToolProgressCallback,
  ): Promise<ToolExecutionResult> {
    // Use provided signal or fall back to the abort controller ref's signal
    const effectiveSignal = signal ?? this.getAbortSignal();

    // MCP tools bypass local registry checks and execute directly via extension
    if (isMcpTool(toolCall.toolName)) {
      try {
        return await executeToolViaExtension(
          toolCall.toolName,
          toolCall.parameters,
          effectiveSignal,
          onProgress,
          this.mode,
        );
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'MCP tool execution failed',
        };
      }
    }

    // Check if tool is registered (exists in the system) - only for built-in tools
    if (!isToolRegistered(toolCall.toolName)) {
      return {
        success: false,
        error: `Invalid tool: ${toolCall.toolName}. This tool is not registered.`,
      };
    }

    // Check if tool is enabled in current mode
    if (!this.enabledTools.includes(toolCall.toolName)) {
      return {
        success: false,
        error: `This tool is not currently available: ${toolCall.toolName}.`,
      };
    }

    const handler = getToolHandler(toolCall.toolName);

    if (!handler) {
      return {
        success: false,
        error: `Invalid tool: ${toolCall.toolName}. This tool is not registered.`,
      };
    }

    return await handler.execute(
      toolCall.parameters,
      effectiveSignal,
      onStatusChange,
      onProgress,
      this.mode,
    );
  }

  /**
   * Execute all tool calls found in a response message
   * Executes only the FIRST tool block for incremental execution
   */
  async executeToolCalls(
    responseMessage: string,
  ): Promise<ToolCallExecutionResult> {
    if (!this.enabledTools.length || !responseMessage) {
      return { executedToolCalls: [], toolResults: [], wasStopped: false };
    }

    // Execute only the FIRST tool block
    const firstBlock = extractFirstToolBlock(responseMessage);
    if (!firstBlock) {
      return { executedToolCalls: [], toolResults: [], wasStopped: false };
    }

    const executedToolCalls: Array<{
      toolName: string;
      parameters: Record<string, unknown>;
      status: 'pending' | 'executing' | 'completed' | 'error' | 'aborted';
      result?: ToolExecutionResult;
    }> = [];
    const toolResults: string[] = [];

    if (this.isStoppingRef.current) {
      return {
        executedToolCalls: [],
        toolResults: [],
        wasStopped: true,
      };
    }

    const toolBlock = firstBlock;

    try {
      const toolCall = {
        toolName: toolBlock.toolName,
        parameters: toolBlock.parameters,
        status: 'executing' as const,
      };

      executedToolCalls.push(toolCall);

      // Check if stopped right after setting executing status
      if (this.isStoppingRef.current) {
        const abortedToolCall = {
          toolName: toolBlock.toolName,
          parameters: toolBlock.parameters,
          status: 'aborted' as const,
          result: { success: false, error: 'Stopped by user' },
        };
        return {
          executedToolCalls: [abortedToolCall],
          toolResults,
          wasStopped: true,
        };
      }

      // Execute the tool
      const result = await this.execute({
        toolName: toolBlock.toolName,
        parameters: toolBlock.parameters,
        status: 'executing',
      });

      // Check if stopped during execution
      if (this.isStoppingRef.current) {
        const abortedToolCall = {
          toolName: toolBlock.toolName,
          parameters: toolBlock.parameters,
          status: 'aborted' as const,
          result: { success: false, error: 'Stopped by user' },
        };
        return {
          executedToolCalls: [abortedToolCall],
          toolResults,
          wasStopped: true,
        };
      }

      // YOLO Mode: Auto-verify plan creation/update to prevent loops
      // This intercepts the plan tool result and simulates user verification
      // so the agent can proceed immediately to handoff without waiting for UI
      if (
        this.mode === 'yolo' &&
        toolBlock.toolName === 'plan' &&
        result.success &&
        result.data
      ) {
        // Cast to extended type that includes dynamic properties added during auto-verification
        const planData = result.data as PlanToolResult & { 
          userAction?: string; 
          autoVerified?: boolean; 
        };
        
        // Only auto-verify create_plan and update_plan (NOT handoff)
        // Handoff requires the frontend to trigger mode switch to 'agent'
        if (
          planData.awaitsUserAction &&
          (planData.mode === 'create_plan' || planData.mode === 'update_plan')
        ) {
          // Mutate the result to simulate user verification
          planData.awaitsUserAction = false;
          planData.userAction = 'verify_plan';
          planData.autoVerified = true;
          planData.message = `[YOLO Mode] Plan "${planData.planTitle || 'Implementation Plan'}" auto-verified. Proceeding to handoff immediately.`;
        }
      }

      // Update tool call with result
      const completedToolCall = {
        toolName: toolBlock.toolName,
        parameters: toolBlock.parameters,
        status: result.success ? ('completed' as const) : ('error' as const),
        result,
      };

      executedToolCalls[0] = completedToolCall;

      // Format result for context - use concise format for file operations
      if (result.success) {
        const data = result.data as Record<string, unknown> | undefined;
        let formattedResult: string;
        
        if (toolBlock.toolName === 'apply_diff' || toolBlock.toolName === 'write_to_file') {
          const path = data?.path as string;
          const action = data?.action as string | undefined;
          if (toolBlock.toolName === 'apply_diff') {
            formattedResult = `[apply_diff] ${path} → ${action === 'no_change' ? 'NO CHANGES' : 'APPLIED'}`;
          } else {
            formattedResult = `[write_to_file] ${path} → ${action === 'created' ? 'CREATED' : action === 'no_change' ? 'NO CHANGES' : 'MODIFIED'}`;
          }
        } else {
          formattedResult = `Tool: ${toolBlock.toolName}\nResult: ${JSON.stringify(result.data, null, 2)}`;
        }
        toolResults.push(formattedResult);
      } else {
        const formattedResult = `Tool: ${toolBlock.toolName}\nError: ${result.error}`;
        toolResults.push(formattedResult);
      }
    } catch (error) {
      const errorToolCall = {
        toolName: toolBlock.toolName,
        parameters: toolBlock.parameters,
        status: 'error' as const,
        result: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      executedToolCalls[0] = errorToolCall;
    }

    return {
      executedToolCalls,
      toolResults,
      wasStopped: false,
    };
  }
}
