import { ClipboardList, HelpCircle, Rocket, FileCheck, RefreshCw } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension } from '../tool-utils';
 
/**
 * Plan Tool Result Types
 */
export type PlanMode = 'ask' | 'create_plan' | 'update_plan' | 'handoff';
 
export interface PlanToolResult {
  mode: PlanMode;
  awaitsUserAction: boolean;
  actionType: 'none' | 'verify_plan' | 'start_implementation';
  questions?: string[];
  planTitle?: string;
  planContent?: string;
  planFilePath?: string;  // Path to the saved plan file (for update_plan mode)
  summary?: string;
  message: string;
}
 
/**
 * Check if a result is a plan tool result
 */
export function isPlanToolResult(data: unknown): data is PlanToolResult {
  return (
    typeof data === 'object' &&
    data !== null &&
    'mode' in data &&
    'awaitsUserAction' in data &&
    'actionType' in data
  );
}
 
/**
 * Plan Tool Execution
 */
async function executePlan(
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolExecutionResult> {
  return executeToolViaExtension('plan', parameters, signal);
}
 
// Register plan tool
registerToolPlugin({
  metadata: {
    id: 'plan',
    name: 'Plan',
    description: 'Create plans, ask questions, and hand off to agent mode',
    icon: ClipboardList,
    usage: 'Use plan tool in plan mode to ask questions, create plans, or hand off to implementation',
    formatExample: '<function_calls>\n<invoke name="plan">\n<parameter name="mode">ask</parameter>\n<parameter name="questions">["What is the target framework?", "Should we use TypeScript?"]</parameter>\n</invoke>\n</function_calls>',
  },
  handler: {
    execute: executePlan,
  },
  renderer: (data: unknown) => {
    if (!isPlanToolResult(data)) {
      return (
        <div className="text-sm" style={{ color: 'var(--vscode-errorForeground)' }}>
          Invalid plan tool result
        </div>
      );
    }
 
    const result = data;
 
    // Render based on mode
    switch (result.mode) {
      case 'ask':
        return <AskModeRenderer questions={result.questions || []} />;
      case 'create_plan':
        return <CreatePlanModeRenderer title={result.planTitle} message={result.message} planContent={result.planContent} />;
      case 'update_plan':
        return <UpdatePlanModeRenderer title={result.planTitle} message={result.message} planContent={result.planContent} />;
      case 'handoff':
        return <HandoffModeRenderer summary={result.summary} message={result.message} />;
      default:
        return (
          <div className="text-sm" style={{ color: 'var(--vscode-descriptionForeground)' }}>
            {result.message}
          </div>
        );
    }
  },
});
 
/**
 * Ask Mode Renderer - Displays questions
 */
function AskModeRenderer({ questions }: { questions: string[] }) {
  return (
    <div className="text-sm space-y-3">
      <div
        className="font-semibold text-xs uppercase tracking-wide flex items-center gap-2"
        style={{ color: 'var(--vscode-descriptionForeground)' }}
      >
        <HelpCircle className="w-4 h-4" />
        Clarifying Questions
      </div>
      <div className="space-y-2">
        {questions.map((question, index) => (
          <div
            key={index}
            className="flex items-start gap-2.5 py-1.5 px-2 rounded-lg"
            style={{ backgroundColor: 'var(--vscode-textBlockQuote-background)' }}
          >
            <span
              className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-xs font-semibold"
              style={{
                backgroundColor: 'var(--vscode-charts-blue)',
                color: 'var(--vscode-editor-background)',
              }}
            >
              {index + 1}
            </span>
            <span
              className="flex-1 leading-relaxed"
              style={{ color: 'var(--vscode-input-foreground)' }}
            >
              {question}
            </span>
          </div>
        ))}
      </div>
      <div
        className="text-xs italic"
        style={{ color: 'var(--vscode-descriptionForeground)' }}
      >
        Please answer these questions to help refine the plan.
      </div>
    </div>
  );
}

/**
 * Truncates content by maximum number of lines
 */
function truncateByLines(content: string, maxLines: number = 5): string {
  if (!content) return '';
  const lines = content.split('\n');
  if (lines.length <= maxLines) {
    return content;
  }
  return lines.slice(0, maxLines).join('\n');
}

/**
 * Plan Content Snippet - Shows truncated plan content by lines
 */
function PlanContentSnippet({ content }: { content?: string }) {
  if (!content) return null;
  
  const truncated = truncateByLines(content);
  
  return (
    <div
      className="py-2 px-3 rounded-lg font-mono text-xs whitespace-pre-wrap"
      style={{ 
        backgroundColor: 'var(--vscode-textBlockQuote-background)',
        color: 'var(--vscode-input-foreground)',
      }}
    >
      {truncated}
    </div>
  );
}

/**
 * Create Plan Mode Renderer - Shows plan was created with content snippet
 */
function CreatePlanModeRenderer({ title, message, planContent }: { title?: string; message: string; planContent?: string }) {
  return (
    <div className="text-sm space-y-3">
      <div
        className="font-semibold text-xs uppercase tracking-wide flex items-center gap-2"
        style={{ color: 'var(--vscode-descriptionForeground)' }}
      >
        <FileCheck className="w-4 h-4" />
        Plan Created
      </div>
      {title && (
        <div
          className="font-medium"
          style={{ color: 'var(--vscode-input-foreground)' }}
        >
          {title}
        </div>
      )}
      <PlanContentSnippet content={planContent} />
      {!planContent && (
        <div
          className="text-xs"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          {message}
        </div>
      )}
    </div>
  );
}

/**
 * Update Plan Mode Renderer - Shows plan was updated with content snippet
 */
function UpdatePlanModeRenderer({ title, message, planContent }: { title?: string; message: string; planContent?: string }) {
  return (
    <div className="text-sm space-y-3">
      <div
        className="font-semibold text-xs uppercase tracking-wide flex items-center gap-2"
        style={{ color: 'var(--vscode-descriptionForeground)' }}
      >
        <RefreshCw className="w-4 h-4" />
        Plan Updated
      </div>
      {title && (
        <div
          className="font-medium"
          style={{ color: 'var(--vscode-input-foreground)' }}
        >
          {title}
        </div>
      )}
      <PlanContentSnippet content={planContent} />
      {!planContent && (
        <div
          className="text-xs"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          {message}
        </div>
      )}
    </div>
  );
}
 
/**
 * Handoff Mode Renderer - Shows handoff summary
 */
function HandoffModeRenderer({ summary, message }: { summary?: string; message: string }) {
  return (
    <div className="text-sm space-y-3">
      <div
        className="font-semibold text-xs uppercase tracking-wide flex items-center gap-2"
        style={{ color: 'var(--vscode-descriptionForeground)' }}
      >
        <Rocket className="w-4 h-4" />
        Ready for Implementation
      </div>
      {summary && (
        <div
          className="py-2 px-3 rounded-lg"
          style={{ 
            backgroundColor: 'var(--vscode-textBlockQuote-background)',
            color: 'var(--vscode-input-foreground)',
          }}
        >
          {summary}
        </div>
      )}
      <div
        className="text-xs"
        style={{ color: 'var(--vscode-descriptionForeground)' }}
      >
        {message}
      </div>
    </div>
  );
}