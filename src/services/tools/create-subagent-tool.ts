import { ITool, ToolExecutionResult } from './tool.interface';
import { getSubAgentService } from '../sub-agent/sub-agent-service';

export class CreateSubAgentTool implements ITool {
  name = 'create_subagent';
  description = 'Create a new sub-agent with a specific persona, workflow, and allowed tools.';
  parameters = {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name of the sub-agent',
      },
      persona: {
        type: 'string',
        description: 'The system prompt/persona for the sub-agent',
      },
      workflow: {
        type: 'string',
        description: 'Optional workflow steps or instructions the agent should follow',
      },
      allowedTools: {
        type: 'array',
        items: {
          type: 'string',
        },
        description: 'List of tool names this sub-agent is allowed to use. report_back is always included.',
      },
    },
    required: ['name', 'persona', 'allowedTools'],
  };

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    try {
      const name = parameters.name as string;
      const persona = parameters.persona as string;
      const workflow = parameters.workflow as string | undefined;
      let allowedTools = parameters.allowedTools as string[];

      // Validate required fields
      if (!name) throw new Error('Name is required');
      if (!persona) throw new Error('Persona is required');

      // Validate allowedTools
      if (!Array.isArray(allowedTools)) {
        // Fallback or error - here we'll default to empty array to allow creation with just report_back
        // effectively, but ideally we should respect the 'required' contract.
        // However, robust handling is better than crashing.
        allowedTools = []; 
      }

      const service = getSubAgentService();
      const definition = service.createSubAgent(name, persona, workflow, allowedTools);
      
      return {
        success: true,
        data: JSON.stringify({
          message: `Sub-agent "${definition.name}" created successfully. Use use_subagent with subAgentName="${definition.name}" to delegate tasks.`,
          name: definition.name,
        })
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Error creating sub-agent: ${errorMessage}`
      };
    }
  }
}