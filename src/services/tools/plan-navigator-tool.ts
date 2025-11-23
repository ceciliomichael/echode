import { ITool, ToolExecutionResult } from './tool.interface';

/**
 * Plan Navigator Tool - Provides clickable follow-up questions in Plan mode
 */
export class PlanNavigatorTool implements ITool {
  name = 'plan_navigator';

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    try {
      const question = parameters.question as unknown;
      const options = parameters.options as unknown;

      // Validate question parameter
      if (typeof question !== 'string' || question.trim().length === 0) {
        return {
          success: false,
          error: 'Parameter "question" must be a non-empty string',
        };
      }

      // Validate options parameter
      if (!Array.isArray(options)) {
        return {
          success: false,
          error: 'Parameter "options" must be an array of strings',
        };
      }

      // Validate each option is a string and trim
      const validOptions = options
        .filter((o): o is string => typeof o === 'string')
        .map(o => o.trim())
        .filter(o => o.length > 0);

      // Limit to 4 options maximum
      const limitedOptions = validOptions.slice(0, 4);

      if (limitedOptions.length === 0) {
        return {
          success: false,
          error: 'At least one valid option string is required',
        };
      }

      return {
        success: true,
        data: {
          question: question.trim(),
          options: limitedOptions,
          count: limitedOptions.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to process plan navigator: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
