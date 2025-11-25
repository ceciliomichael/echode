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
    description: 'Offers to switch from Plan mode to Agent mode for implementation',
    aiDescription: `Signal that planning is complete and offer to switch to implementation (Agent) mode.

**When to use:**
- After completing your planning analysis and creating a structured plan
- When you've answered all clarifying questions
- Before you would normally start implementing code changes

**Parameters:**
- summary: Brief 1-3 sentence summary of what will be implemented (optional)

**Example:**
<function_calls>
<invoke name="plan_handoff">
<parameter name="summary">Ready to implement the authentication system with JWT tokens, login/logout endpoints, and user session management as planned.</parameter>
</invoke>
</function_calls>

**Important:**
- Use this ONLY when the plan is truly complete
- After the user clicks "Start Implementation", you'll switch to Agent mode with full tool access
- The user must explicitly approve before implementation begins`,
    icon: Rocket,
    usage: 'Offer to switch from Plan mode to Agent mode for implementation',
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
  // Check if button was already clicked (persisted in tool result data)
  const resultData = data as { clicked?: boolean } | undefined;
  const wasClicked = resultData?.clicked === true;
  
  const [isSwitching, setIsSwitching] = useState(wasClicked);

  const handleImplementClick = () => {
    if (isSwitching) return;
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
        className="px-3 py-2 rounded-lg mb-3 border"
        style={{
          backgroundColor: 'var(--vscode-input-background)',
          borderColor: 'var(--vscode-input-border)',
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
              This will switch you to Agent mode where I can create and modify files
            </div>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button
        type="button"
        onClick={handleImplementClick}
        disabled={isSwitching}
        className="w-full px-3 py-2.5 rounded-lg border text-xs font-medium transition-all flex items-center justify-center gap-2"
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
          cursor: isSwitching ? 'default' : 'pointer',
        }}
        onMouseEnter={(e) => {
          if (isSwitching) return;
          e.currentTarget.style.backgroundColor = 'var(--vscode-button-hoverBackground)';
        }}
        onMouseLeave={(e) => {
          if (isSwitching) return;
          e.currentTarget.style.backgroundColor = 'var(--vscode-button-background)';
        }}
      >
        <Rocket className="w-3.5 h-3.5" />
        <span>{isSwitching ? 'Switching to Agent mode...' : 'Start Implementation'}</span>
      </button>
    </div>
  );
}
