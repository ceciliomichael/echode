import type { ToolCall, ToolExecutionResult, ParsedToolBlock } from '../types/tool';
import type { ChatMode } from '../types/chat-mode';
import { getToolHandler, type ToolStatusCallback, isToolRegistered } from './tool-registry';
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
  mode: ChatMode;
}

export class ToolExecutor {
  private enabledTools: string[];
  private isStoppingRef: { current: boolean };
  private mode: ChatMode;

  constructor(options: ToolExecutorOptions) {
    this.enabledTools = options.enabledTools;
    this.isStoppingRef = options.isStoppingRef;
    this.mode = options.mode;
  }

  /**
   * Execute tool call
   */
  async execute(
    toolCall: ToolCall,
    signal?: AbortSignal,
    onStatusChange?: ToolStatusCallback,
  ): Promise<ToolExecutionResult> {
    // Check if tool is registered (exists in the system)
    if (!isToolRegistered(toolCall.toolName)) {
      return {
        success: false,
        error: `Invalid tool: ${toolCall.toolName}. This tool is not registered.`,
      };
    }

    // Check if tool is enabled in current mode
    if (!this.enabledTools.includes(toolCall.toolName)) {
      let errorMessage: string;
      if (this.mode === 'plan') {
        errorMessage = `You are currently in Plan mode and are not allowed to use this tool: ${toolCall.toolName}.`;
      } else if (this.mode === 'ask') {
        // Special message for echo_search in Ask mode
        if (toolCall.toolName === 'echo_search') {
          errorMessage = `The echo_search tool is only available in Agent mode. Switch to Agent mode to use the sub-agent code search.`;
        } else {
          errorMessage = `You are currently in Ask mode and may only use read_file, list_files, grep_search, and glob_search. This tool is not allowed: ${toolCall.toolName}.`;
        }
      } else {
        errorMessage = `Tool "${toolCall.toolName}" is disabled in the current configuration.`;
      }
      return {
        success: false,
        error: errorMessage,
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

  /**
   * Execute multiple tool blocks in parallel
   * Used for parallelizable tools like read_file
   */
  async executeToolBlocksInParallel(
    toolBlocks: ParsedToolBlock[],
  ): Promise<ToolCallExecutionResult> {
    if (!this.enabledTools.length || toolBlocks.length === 0) {
      return { executedToolCalls: [], toolResults: [], wasStopped: false };
    }

    if (this.isStoppingRef.current) {
      return {
        executedToolCalls: [],
        toolResults: [],
        wasStopped: true,
      };
    }

    console.log(`[ToolExecutor] Executing ${toolBlocks.length} tools in parallel`);

    // Execute all tools in parallel
    const executionPromises = toolBlocks.map(async (block) => {
      try {
        // Check if stopped before execution
        if (this.isStoppingRef.current) {
          return {
            toolName: block.toolName,
            parameters: block.parameters,
            status: 'aborted' as const,
            result: { success: false, error: 'Stopped by user' },
          };
        }

        const result = await this.execute({
          toolName: block.toolName,
          parameters: block.parameters,
          status: 'executing',
        });

        // Check if stopped during execution
        if (this.isStoppingRef.current) {
          return {
            toolName: block.toolName,
            parameters: block.parameters,
            status: 'aborted' as const,
            result: { success: false, error: 'Stopped by user' },
          };
        }

        return {
          toolName: block.toolName,
          parameters: block.parameters,
          status: result.success ? ('completed' as const) : ('error' as const),
          result,
        };
      } catch (error) {
        return {
          toolName: block.toolName,
          parameters: block.parameters,
          status: 'error' as const,
          result: {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        };
      }
    });

    // Wait for all executions to complete
    const executedToolCalls = await Promise.all(executionPromises);

    // Check if stopped after all executions
    if (this.isStoppingRef.current) {
      return {
        executedToolCalls: executedToolCalls.map(call => ({
          ...call,
          status: 'aborted' as const,
          result: { success: false, error: 'Stopped by user' },
        })),
        toolResults: [],
        wasStopped: true,
      };
    }

    // Format results for context
    const toolResults = executedToolCalls.map(call => {
      if (call.result?.success && 'data' in call.result && call.result.data !== undefined) {
        return `Tool: ${call.toolName}\nResult: ${JSON.stringify(call.result.data, null, 2)}`;
      } else if (call.result?.error) {
        return `Tool: ${call.toolName}\nError: ${call.result.error}`;
      } else {
        return `Tool: ${call.toolName}\nStatus: ${call.status}`;
      }
    });

    console.log(`[ToolExecutor] Completed ${executedToolCalls.length} parallel executions`);

    return {
      executedToolCalls,
      toolResults,
      wasStopped: false,
    };
  }
}
