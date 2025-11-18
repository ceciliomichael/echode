import type { ToolCall, ToolExecutionResult } from '../types/tool';
import { getToolHandler, type ToolStatusCallback } from './tool-registry';
import { extractFirstToolBlock } from './tool-parser';

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
}

export class ToolExecutor {
  private enabledTools: string[];
  private isStoppingRef: { current: boolean };

  constructor(options: ToolExecutorOptions) {
    this.enabledTools = options.enabledTools;
    this.isStoppingRef = options.isStoppingRef;
  }

  /**
   * Execute tool call
   */
  async execute(
    toolCall: ToolCall,
    signal?: AbortSignal,
    onStatusChange?: ToolStatusCallback,
  ): Promise<ToolExecutionResult> {
    const handler = getToolHandler(toolCall.toolName);

    if (!handler) {
      return {
        success: false,
        error: `Unknown tool: ${toolCall.toolName}`,
      };
    }

    return await handler.execute(
      toolCall.parameters,
      signal,
      onStatusChange,
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

      // Update tool call with result
      const completedToolCall = {
        toolName: toolBlock.toolName,
        parameters: toolBlock.parameters,
        status: result.success ? ('completed' as const) : ('error' as const),
        result,
      };

      executedToolCalls[0] = completedToolCall;

      // Format result for context
      if (result.success) {
        const formattedResult = `Tool: ${toolBlock.toolName}\nResult: ${JSON.stringify(result.data, null, 2)}`;
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
