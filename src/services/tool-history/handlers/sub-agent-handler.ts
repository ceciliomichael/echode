import { IToolHistoryHandler } from './handler.interface';
import { ToolHistoryResult, ToolDataRecord } from '../types';
import { ChatHistoryService } from '../../chat-history-service';
import { ToolHistoryService } from '../tool-history-service';
import { getSubAgentService } from '../../sub-agent/sub-agent-service';

export class SubAgentHandler implements IToolHistoryHandler {
  readonly supportedTools = ['use_subagent'];

  constructor(
    private chatHistoryService: ChatHistoryService,
    private toolHistoryService: ToolHistoryService
  ) {}

  async undo(
    toolName: string,
    data: ToolDataRecord,
    workspacePath: string
  ): Promise<ToolHistoryResult> {
    try {
      // 1. Get session ID from tool result
      // The result format is { status: 'completed', result: ..., sessionId: ... }
      // But 'data' here is the *result* of the tool execution, which UseSubAgentTool returns as:
      // data: JSON.stringify({ status: 'completed', result: ..., sessionId: ... })
      
      // Wait, ToolExecutionState.result.data is what's passed here. 
      // In UseSubAgentTool, we return { success: true, data: string_json }.
      // So 'data' passed here is actually the tool execution result object?
      // Let's check ToolHistoryService.undoToolExecution:
      // const data = toolExecution.result.data as Record<string, unknown>;
      
      // If UseSubAgentTool returns a string as data, then 'data' here is that string?
      // No, ToolExecutionResult.data is usually an object or string.
      // In UseSubAgentTool.execute:
      // return { success: true, data: JSON.stringify(...) }
      // So toolExecution.result.data is a STRING.
      
      // Typescript says ToolDataRecord is Record<string, unknown>.
      // If the actual data is a string, this cast in ToolHistoryService might be wrong or I need to handle it.
      
      // Let's assume toolExecution.result.data is the string we returned.
      let resultData: any = data;
      
      // If data is just the string (which it is for use_subagent), we need to parse it?
      // But ToolHistoryService casts it to Record<string, unknown>. 
      // If it's a string, that cast is invalid at runtime but TS accepts it.
      
      // However, looking at ToolHistoryService:
      // const data = toolExecution.result.data as Record<string, unknown>;
      // console.log(..., data.path || data);
      
      // If 'data' is a string, then data.path is undefined.
      
      let sessionId: string | undefined;
      
      // Log input for debugging
      console.log('[SubAgentHandler] Undoing sub-agent task. Data type:', typeof data);

      if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data);
          sessionId = parsed.sessionId;
        } catch (e) {
          console.error('[SubAgentHandler] JSON parse error:', e);
          return { success: false, error: 'Failed to parse sub-agent result data' };
        }
      } else if (typeof data === 'object' && data !== null) {
        // Try to find sessionId in various likely locations
        sessionId = (data as any).sessionId;
        
        // Sometimes it might be nested in a 'result' or 'data' property if wrapping changed
        if (!sessionId && (data as any).data) {
          if (typeof (data as any).data === 'string') {
             try {
                const parsed = JSON.parse((data as any).data);
                sessionId = parsed.sessionId;
             } catch (e) {}
          } else if (typeof (data as any).data === 'object') {
             sessionId = (data as any).data.sessionId;
          }
        }
      }

      if (!sessionId) {
        // If the sub-agent is still running, the use_subagent tool execution may not have
        // returned its final result (which includes sessionId) yet.
        // In that case, try to fall back to the only active sub-agent session (if unambiguous).
        const active = getSubAgentService().getActiveSessions();
        if (active.length === 1) {
          sessionId = active[0].id;
          console.warn('[SubAgentHandler] No sessionId in tool result; falling back to active session:', sessionId);
        } else {
          console.error('[SubAgentHandler] No session ID found. Data:', JSON.stringify(data));
          return {
            success: false,
            error: 'No session ID found in sub-agent result. Cannot revert sub-agent actions.'
          };
        }
      }
      
      console.log('[SubAgentHandler] Reverting session:', sessionId);

      // 2. Load the sub-agent session
      const session = await this.chatHistoryService.getSession(sessionId);
      if (!session) {
        return { success: false, error: `Sub-agent session ${sessionId} not found` };
      }

      // 3. Reverse iterate messages and undo tools
      // We need to undo in reverse order (last message first)
      const messagesToRevert = [...session.messages].reverse();
      const errors: string[] = [];

      for (const msg of messagesToRevert) {
        if (msg.toolExecutions && msg.toolExecutions.length > 0) {
           // msg.toolExecutions is Array<[string, ToolExecutionState]>
           // Convert to Map for undoToolExecutions
           const toolExecutionsMap = new Map(msg.toolExecutions);
           
           const result = await this.toolHistoryService.undoToolExecutions(toolExecutionsMap, workspacePath);
           if (!result.success) {
             errors.push(...result.errors);
           }
        }
      }

      if (errors.length > 0) {
        return { 
          success: false, 
          error: `Failed to undo some sub-agent actions: ${errors.join(', ')}` 
        };
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: `Failed to undo sub-agent session: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  async redo(
    toolName: string,
    data: ToolDataRecord,
    workspacePath: string
  ): Promise<ToolHistoryResult> {
    // Redo logic is similar but in forward order
    // NOTE: Redo for sub-agent is tricky. We can't easily "re-run" the agent.
    // But we can re-apply the *tool modifications* if they were simple edits.
    // However, ToolHistoryService.redoToolExecution calls the handler's redo.
    // If we call toolHistoryService.redoToolExecutions, it calls the handlers for those tools.
    // So if the sub-agent used 'edit', we call 'edit' handler's redo. This should work!
    
    try {
      let sessionId: string | undefined;
      
      if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data);
          sessionId = parsed.sessionId;
        } catch (e) {
          return { success: false, error: 'Failed to parse sub-agent result data' };
        }
      } else if (typeof data === 'object' && data !== null) {
        sessionId = (data as any).sessionId;
      }

      if (!sessionId) {
        return { success: false, error: 'No session ID found in sub-agent result' };
      }

      const session = await this.chatHistoryService.getSession(sessionId);
      if (!session) {
        return { success: false, error: `Sub-agent session ${sessionId} not found` };
      }

      // Redo in forward order
      const messagesToRedo = session.messages;
      const errors: string[] = [];

      for (const msg of messagesToRedo) {
        if (msg.toolExecutions && msg.toolExecutions.length > 0) {
           const toolExecutionsMap = new Map(msg.toolExecutions);
           const result = await this.toolHistoryService.redoToolExecutions(toolExecutionsMap, workspacePath);
           if (!result.success) {
             errors.push(...result.errors);
           }
        }
      }

      if (errors.length > 0) {
        return { 
          success: false, 
          error: `Failed to redo some sub-agent actions: ${errors.join(', ')}` 
        };
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: `Failed to redo sub-agent session: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}