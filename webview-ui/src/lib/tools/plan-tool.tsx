import { ClipboardList, Rocket, FileCheck, RefreshCw } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension } from '../tool-utils';
import { TOOL_FUNCTION_CALLS_CLOSE, TOOL_FUNCTION_CALLS_OPEN, TOOL_XML_NAMESPACE } from '../tool-xml';
 
/**
 * Plan Tool Result Types
 */
export type PlanMode = 'create_plan' | 'update_plan' | 'handoff';
 
export interface PlanToolResult {
  mode: PlanMode;
  awaitsUserAction: boolean;
  actionType: 'verify_plan' | 'start_implementation';
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
    description: 'Create plans and hand off to agent mode',
    icon: ClipboardList,
    usage: 'Use plan tool in plan mode to create plans or hand off to implementation',
    formatExample: `${TOOL_FUNCTION_CALLS_OPEN}\n<${TOOL_XML_NAMESPACE}:invoke name="plan">\n<${TOOL_XML_NAMESPACE}:parameter name="mode">create_plan</${TOOL_XML_NAMESPACE}:parameter>\n<${TOOL_XML_NAMESPACE}:parameter name="title">Implementation Plan</${TOOL_XML_NAMESPACE}:parameter>\n<${TOOL_XML_NAMESPACE}:parameter name="plan">## Overview\nPlan content here...</${TOOL_XML_NAMESPACE}:parameter>\n</${TOOL_XML_NAMESPACE}:invoke>\n${TOOL_FUNCTION_CALLS_CLOSE}`,
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
 * Handoff Mode Renderer - Shows ready for implementation
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
