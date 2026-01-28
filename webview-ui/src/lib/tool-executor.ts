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
    status: 'pending' | 'executing' | 'completed' | 'error' | 'aborted' | 'rejected';
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
  /** The original UI mode before any conversions (e.g., 'yolo' before it becomes 'plan' or 'agent') */
  originalMode?: ChatMode;
}

export class ToolExecutor {
  private enabledTools: string[];
  private isStoppingRef: { current: boolean };
  private abortControllerRef?: { current: AbortController | null };
  public readonly mode?: ChatMode;
  public readonly originalMode?: ChatMode;

  constructor(options: ToolExecutorOptions) {
    this.enabledTools = options.enabledTools;
    this.isStoppingRef = options.isStoppingRef;
    this.abortControllerRef = options.abortControllerRef;
    this.mode = options.mode;
    this.originalMode = options.originalMode;
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

    const result = await handler.execute(
      toolCall.parameters,
      effectiveSignal,
      onStatusChange,
      onProgress,
      this.mode,
    );

    // YOLO Mode: Auto-verify plan tool actions (create_plan, update_plan, handoff)
    // This ensures the continuation happens immediately without waiting for UI button clicks
    // Check originalMode for YOLO detection (mode is converted from 'yolo' to 'plan'/'agent')
    const isYoloMode = this.originalMode === 'yolo' || this.mode === 'yolo';
    if (
      isYoloMode &&
      toolCall.toolName === 'plan' &&
      result.success &&
      result.data
    ) {
      const planData = result.data as PlanToolResult & {
        userAction?: string;
        autoVerified?: boolean;
      };

      // Auto-verify all plan modes in YOLO - no user intervention needed
      if (planData.awaitsUserAction) {
        planData.awaitsUserAction = false;
        planData.autoVerified = true;

        if (planData.mode === 'handoff') {
          planData.userAction = 'start_implementation';
          planData.message = `[YOLO Mode] Implementation approved automatically. Starting execution.`;
        } else {
          planData.userAction = 'verify_plan';
          planData.message = `[YOLO Mode] Plan "${planData.planTitle || 'Implementation Plan'}" auto-verified. Proceeding immediately.`;
        }
      }
    }

    return result;
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
      status: 'pending' | 'executing' | 'completed' | 'error' | 'aborted' | 'rejected';
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

      // Update tool call with result
      // Note: YOLO mode auto-verification is handled in execute() method
      // Detect if tool was rejected by user in Manual Mode
      // Detect if tool was rejected by user in Manual Mode (case-insensitive)
      const isRejected = !result.success && (
        result.error?.includes('REJECTED_BY_USER') || 
        result.error?.toLowerCase().includes('rejected by user')
      );
      
      const status = result.success 
        ? ('completed' as const) 
        : isRejected 
          ? ('rejected' as const) 
          : ('error' as const);
      
      const completedToolCall = {
        toolName: toolBlock.toolName,
        parameters: toolBlock.parameters,
        status,
        result,
      };

      executedToolCalls[0] = completedToolCall;

      // Format result for context - use concise format for file operations
      if (result.success) {
        const data = result.data as Record<string, unknown> | undefined;
        let formattedResult: string;
        
        if (toolBlock.toolName === 'edit' || toolBlock.toolName === 'write_to_file') {
          const path = data?.path as string;
          const action = data?.action as string | undefined;
          if (toolBlock.toolName === 'edit') {
            formattedResult = `[edit] ${path} → ${action === 'no_change' ? 'NO CHANGES' : 'APPLIED'}`;
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check if this is a rejection error caught as an exception
      const isRejected = errorMessage.includes('REJECTED_BY_USER') || 
                         errorMessage.toLowerCase().includes('rejected by user');
      
      const status = isRejected ? ('rejected' as const) : ('error' as const);
      
      const errorToolCall = {
        toolName: toolBlock.toolName,
        parameters: toolBlock.parameters,
        status,
        result: {
          success: false,
          error: errorMessage,
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
