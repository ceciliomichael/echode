import { ITool, ToolExecutionResult } from './tool.interface';
import { getSubAgentService } from '../sub-agent/sub-agent-service';

export class ReportBackTool implements ITool {
  name = 'report_back';
  description = 'Report the final result back to the main agent and end the session.';
  parameters = {
    type: 'object',
    properties: {
      result: {
        type: 'object',
        description: 'The result data to return',
        additionalProperties: true,
      },
    },
    required: ['result'],
  };

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    try {
      // sessionId is injected by the system automatically
      const sessionId = parameters.sessionId as string;
      if (!sessionId) {
        throw new Error('Session ID missing. This should be automatically injected by the system.');
      }

      const result = parameters.result;

      const service = getSubAgentService();
      const success = service.resolveSession(sessionId, result);
      
      if (!success) {
        throw new Error(`Invalid session ID: ${sessionId}. Please verify the session ID provided in your system prompt.`);
      }
      
      return {
        success: true,
        data: 'Result reported successfully. Session ending.'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Error reporting back: ${errorMessage}`
      };
    }
  }
}