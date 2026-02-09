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
        description: 'List of tool names this sub-agent is allowed to use.',
      },
    },
    required: ['name', 'persona', 'allowedTools'],
  };

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    try {
      const name = parameters.name as string;
      const persona = parameters.persona as string;
      const workflow = parameters.workflow as string | undefined;
      let allowedTools = parameters.allowedTools;

      // Validate required fields
      if (!name) throw new Error('Name is required');
      if (!persona) throw new Error('Persona is required');

      // Robust parsing for allowedTools
      if (typeof allowedTools === 'string') {
        try {
          // Try parsing as JSON first
          allowedTools = JSON.parse(allowedTools);
        } catch {
          // If simple comma separated string, split and clean
          allowedTools = (allowedTools as string).split(',').map(t => t.trim().replace(/['"\[\]]/g, ''));
        }
      }

      // Final validation to ensure array
      if (!Array.isArray(allowedTools)) {
        allowedTools = []; 
      }

      const finalAllowedTools = allowedTools as string[];

      const service = getSubAgentService();
      const definition = service.createSubAgent(name, persona, workflow, finalAllowedTools);
      
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