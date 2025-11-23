import { ITool, ToolExecutionResult } from './tool.interface';

/**
 * Plan Handoff Tool - Provides "Ready to Implement?" button to switch from Plan to Agent mode
 */
export class PlanHandoffTool implements ITool {
  name = 'plan_handoff';

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    try {
      const summary = (parameters.summary as string) || '';

      // Summary is optional but should be trimmed if provided
      const trimmedSummary = summary.trim();

      return {
        success: true,
        data: {
          summary: trimmedSummary,
          message: 'Ready to switch to implementation mode',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to process handoff: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
