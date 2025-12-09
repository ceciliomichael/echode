import { useState } from 'react';
import { Rocket } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension } from '../tool-utils';

/**
 * Plan Handoff Tool - Provides "Ready to Implement?" button to switch to Agent mode
 */
async function executePlanHandoff(
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolExecutionResult> {
  return executeToolViaExtension('plan_handoff', parameters, signal);
}

// Register plan_handoff tool
registerToolPlugin({
  metadata: {
    id: 'plan_handoff',
    name: 'Implementation Handoff',
    description: 'Offers to transition from planning to implementation',
    aiDescription: `## plan_handoff
Signal that planning is complete and offer to begin implementation.

**WHEN TO USE:**
- Planning analysis is complete
- Todo list is created with todo_write
- All clarifying questions are answered
- Ready to start actual code changes

**Parameters:**
- summary: Brief 1-3 sentence summary of what will be implemented (optional)

**WORKFLOW:**

explore → analyze → create plan with todo_write → plan_handoff


**IMPORTANT:**
- Only use when the plan is truly complete
- User must click "Start Implementation" to begin
- If user sends a message after this, the handoff is invalidated
- Update plan based on feedback, then call plan_handoff again`,
    icon: Rocket,
    usage: 'Offer to transition from planning to implementation',
    formatExample: '<function_calls>\n<invoke name="plan_handoff">\n<parameter name="summary">Brief implementation summary</parameter>\n</invoke>\n</function_calls>',
  },
  handler: {
    execute: executePlanHandoff,
  },
  renderer: (data: unknown) => <PlanHandoffRenderer data={data} />,
});

interface PlanHandoffRendererProps {
  data?: unknown;
}

export function PlanHandoffRenderer({ data }: PlanHandoffRendererProps) {
  // Check if button was already clicked or superseded (persisted in tool result data)
  const resultData = data as { clicked?: boolean; superseded?: boolean } | undefined;
  const wasClicked = resultData?.clicked === true;
  const isSuperseded = resultData?.superseded === true;

  const [isSwitching, setIsSwitching] = useState(wasClicked);

  // Button is disabled if already clicked/switching or superseded by user message
  const isDisabled = isSwitching || isSuperseded;

  const handleImplementClick = () => {
    if (isDisabled) return;
    setIsSwitching(true);

    // Dispatch event with flag to update tool result data
    window.dispatchEvent(new CustomEvent('echode:planImplementHandoff', {
      detail: { markAsClicked: true }
    }));
  };

  return (
    <div className="py-3 px-1">
      {/* Info Section */}
      <div
        className="px-3 py-2 rounded-xl mb-3 border"
        style={{
          backgroundColor: 'var(--vscode-input-background)',
          borderColor: 'var(--vscode-input-border)',
          opacity: isSuperseded ? 0.5 : 1,
        }}
      >
        <div className="flex items-start gap-2">
          <Rocket
            className="w-4 h-4 mt-0.5 flex-shrink-0"
            style={{ color: 'var(--vscode-charts-orange)' }}
          />
          <div className="flex-1 min-w-0">
            <div
              className="text-xs font-medium mb-1"
              style={{ color: 'var(--vscode-foreground)' }}
            >
              Ready to implement
            </div>
            <div
              className="text-[10px] leading-relaxed opacity-70"
              style={{ color: 'var(--vscode-descriptionForeground)' }}
            >
              This will transition to implementation where I can create and modify files
            </div>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button
        type="button"
        onClick={handleImplementClick}
        disabled={isDisabled}
        className="w-full px-3 py-2.5 rounded-xl border text-xs font-medium transition-all flex items-center justify-center gap-2"
        style={{
          backgroundColor: isSwitching
            ? 'rgba(249, 115, 22, 0.15)'
            : 'var(--vscode-button-background)',
          color: isSwitching
            ? 'var(--vscode-charts-orange)'
            : 'var(--vscode-button-foreground)',
          borderColor: isSwitching
            ? 'var(--vscode-charts-orange)'
            : 'var(--vscode-button-border)',
          minHeight: '40px',
          opacity: isSuperseded ? 0.4 : 1,
          cursor: isDisabled ? (isSwitching ? 'default' : 'not-allowed') : 'pointer',
        }}
        onMouseEnter={(e) => {
          if (isDisabled) return;
          e.currentTarget.style.backgroundColor = 'var(--vscode-button-hoverBackground)';
        }}
        onMouseLeave={(e) => {
          if (isDisabled) return;
          e.currentTarget.style.backgroundColor = 'var(--vscode-button-background)';
        }}
      >
        <Rocket className="w-3.5 h-3.5" />
        <span>{isSwitching ? 'Transitioning to implementation...' : 'Start Implementation'}</span>
      </button>
    </div>
  );
}
