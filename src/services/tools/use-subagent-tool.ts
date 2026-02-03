import { ITool, ToolExecutionResult } from './tool.interface';
import { getSubAgentService } from '../sub-agent/sub-agent-service';
import { SubAgentSession } from '../sub-agent/types';

export interface SubAgentHost {
  openSubAgentPanel(session: SubAgentSession): Promise<void>;
}

export class UseSubAgentTool implements ITool {
  name = 'use_subagent';
  description = 'Delegate a task to a sub-agent. Opens a new panel where the agent works autonomously.';
  parameters = {
    type: 'object',
    properties: {
      subAgentName: {
        type: 'string',
        description: 'The name of the sub-agent to use',
      },
      task: {
        type: 'string',
        description: 'The specific task for the sub-agent to perform',
      },
    },
    required: ['subAgentName', 'task'],
  };

  constructor(private host: SubAgentHost) {}

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    try {
      const subAgentName = parameters.subAgentName as string;
      const task = parameters.task as string;

      const service = getSubAgentService();
      const { session, resultPromise } = service.createSession(subAgentName, task);

      // Open the sub-agent panel via host interface
      await this.host.openSubAgentPanel(session);

      // Wait for the sub-agent to report back
      const result = await resultPromise;

      return {
        success: true,
        data: JSON.stringify({
          status: 'completed',
          result: result,
          sessionId: session.id, // Return sessionId to allow undo/revert
        })
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Error executing sub-agent task: ${errorMessage}`
      };
    }
  }
}