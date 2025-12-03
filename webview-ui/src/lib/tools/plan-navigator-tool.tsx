import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension } from '../tool-utils';

/**
 * Plan Navigator Tool - Provides clickable follow-up questions in Plan mode
 */
async function executePlanNavigator(
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolExecutionResult> {
  return executeToolViaExtension('plan_navigator', parameters, signal);
}

// Register plan_navigator tool
registerToolPlugin({
  metadata: {
    id: 'plan_navigator',
    name: 'Plan Navigator',
    description: 'Provides a question with clickable options during planning',
    aiDescription: `Present a question with up to 4 clickable options to guide the planning discussion.

**When to use:**
- When you need the user to choose between specific implementation strategies
- To get quick confirmation on a preference
- To narrow down scope with predefined choices

**Parameters:**
- question: The main question string (required)
- options: Array of 1-4 short option strings (required)

**Example:**
<function_calls>
<invoke name="plan_navigator">
<parameter name="question">Which authentication method should we implement?</parameter>
<parameter name="options">["JWT with local storage", "Session cookies", "OAuth2 / Social Login"]</parameter>
</invoke>
</function_calls>

**Best practices:**
- Keep the question clear and concise
- Keep options short (under 40 characters)
- Use this instead of asking open-ended questions when you have specific paths in mind`,
    icon: HelpCircle,
    usage: 'Present a question with clickable options',
    formatExample: '<function_calls>\n<invoke name="plan_navigator">\n<parameter name="question">Question text?</parameter>\n<parameter name="options">["Option 1", "Option 2"]</parameter>\n</invoke>\n</function_calls>',
  },
  handler: {
    execute: executePlanNavigator,
  },
  renderer: (data: unknown) => <PlanNavigatorRenderer data={data} />,
});

export function PlanNavigatorRenderer({ data }: { data: unknown }) {
  const [clickedIndex, setClickedIndex] = useState<number | null>(null);

  if (typeof data !== 'object' || data === null || !('question' in data) || !('options' in data)) {
    return (
      <div className="text-sm" style={{ color: 'var(--vscode-errorForeground)' }}>
        Invalid plan navigator data
      </div>
    );
  }

  const result = data as { 
    question: string;
    options: string[];
    selectedIndex?: number;
    superseded?: boolean;
  };

  const question = result.question || '';
  const options = result.options || [];
  const persistedIndex = result.selectedIndex ?? null;
  const isSuperseded = result.superseded === true;
  
  // Use persisted index if available, otherwise use local state
  const effectiveClickedIndex = clickedIndex ?? persistedIndex;

  if (options.length === 0) {
    return (
      <div className="text-sm" style={{ color: 'var(--vscode-errorForeground)' }}>
        No options provided
      </div>
    );
  }

  const handleOptionClick = (option: string, index: number) => {
    if (effectiveClickedIndex !== null || isSuperseded) return; // Prevent clicking if already clicked, persisted, or superseded
    setClickedIndex(index);
    window.dispatchEvent(new CustomEvent('echode:quickQuestion', {
      detail: { question: option, selectedIndex: index }
    }));
  };

  // Determine if buttons should be disabled (either selection made or superseded by user message)
  const isInteractionDisabled = effectiveClickedIndex !== null || isSuperseded;

  return (
    <div className="py-2 px-1">
      {question && (
        <div 
          className="text-xs font-medium mb-2 px-2 opacity-80"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          {question}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        {options.map((option, index) => {
          const isClicked = effectiveClickedIndex === index;
          const hasSelection = effectiveClickedIndex !== null;
          // Button is disabled if: superseded, or has selection and not the clicked one
          const isButtonDisabled = isSuperseded || (hasSelection && !isClicked);

          return (
            <button
              key={index}
              type="button"
              onClick={() => handleOptionClick(option, index)}
              disabled={isInteractionDisabled}
              className="w-full text-left px-3 py-2 rounded-xl border text-xs transition-all"
              style={{
                backgroundColor: isClicked 
                  ? 'rgba(249, 115, 22, 0.15)'
                  : 'var(--vscode-input-background)',
                color: isClicked 
                  ? 'var(--vscode-charts-orange)'
                  : 'var(--vscode-foreground)',
                borderColor: isClicked 
                  ? 'var(--vscode-charts-orange)'
                  : 'var(--vscode-input-border)',
                minHeight: '36px',
                opacity: isButtonDisabled ? 0.4 : 1,
                cursor: isInteractionDisabled ? (isClicked ? 'default' : 'not-allowed') : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!isInteractionDisabled && !isClicked) {
                  e.currentTarget.style.opacity = '0.8';
                }
              }}
              onMouseLeave={(e) => {
                if (!isInteractionDisabled && !isClicked) {
                  e.currentTarget.style.opacity = '1';
                }
              }}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
