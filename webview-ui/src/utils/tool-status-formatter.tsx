import type { ReactNode } from 'react';
import { getToolMetadata } from '../lib/tool-registry';
import type { ToolCall } from '../types/tool';
import { calculateDiffStats } from './diff-calculator';
import type { PlanMode } from '../lib/tools/plan-tool';

function renderWaveLabel(text: string): ReactNode {
  return (
    <span
      className="text-sm"
      style={{
        background:
          'linear-gradient(90deg, var(--vscode-descriptionForeground) 0%, var(--vscode-descriptionForeground) 40%, var(--vscode-foreground) 50%, var(--vscode-descriptionForeground) 60%, var(--vscode-descriptionForeground) 100%)',
        backgroundSize: '300% 100%',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        animation: 'wave-shine 2s linear infinite',
      }}
    >
      {text}
    </span>
  );
}

/**
 * Get status display for a tool based on its current state
 */
export function getToolStatusDisplay(
  toolCall: ToolCall,
  isStreaming: boolean
): ReactNode {
  // Handle error and aborted states first
  if (toolCall.status === 'error') {
    return 'Error';
  }
  if (toolCall.status === 'aborted') {
    return 'Aborted';
  }

  // IMPORTANT: If the tool has completed with results, show the completed state
  // even if isStreaming is still true.
  const isCompletedWithResult = toolCall.status === 'completed' && toolCall.result;
  if (!isCompletedWithResult && (isStreaming || toolCall.status === 'pending' || toolCall.status === 'executing')) {
    const toolName = toolCall.toolName;
    let executingText = 'Executing';

    // Tool-specific executing states
    if (toolName === 'read_file') {
      executingText = 'Reading';
    } else if (toolName === 'write_to_file') {
      executingText = 'Writing';
    } else if (toolName === 'delete_file') {
      executingText = 'Deleting';
    } else if (toolName === 'list_files') {
      executingText = 'Listing';
    } else if (toolName === 'grep_search') {
      executingText = 'Searching';
    } else if (toolName === 'todo_write' || toolName === 'todo_read') {
      executingText = 'Processing';
    } else if (toolName === 'apply_diff') {
      executingText = 'Editing';
    } else if (toolName === 'echo_search') {
      executingText = 'Echoing';
    } else if (toolName === 'get_diagnostics') {
      executingText = 'Linting';
    } else if (toolName === 'glob_search') {
      executingText = 'Searching';
    } else if (toolName === 'plan') {
      const mode = toolCall.parameters.mode as string;
      if (mode === 'create_plan') {
        executingText = 'Creating';
      } else if (mode === 'update_plan') {
        executingText = 'Updating';
      } else if (mode === 'handoff') {
        executingText = 'Finalizing';
      } else {
        executingText = 'Planning';
      }
    } else if (toolName === 'run_terminal') {
      executingText = 'Running';
    }

    return renderWaveLabel(executingText);
  }

  // Show loading dots while fetching diagnostics
  if (toolCall.status === 'fetching_diagnostics') {
    return (
      <span
        className="text-sm"
        style={{
          background:
            'linear-gradient(90deg, var(--vscode-descriptionForeground) 0%, var(--vscode-descriptionForeground) 40%, var(--vscode-foreground) 50%, var(--vscode-descriptionForeground) 60%, var(--vscode-descriptionForeground) 100%)',
          backgroundSize: '300% 100%',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: 'wave-shine 2s linear infinite',
        }}
      >
        Linting
      </span>
    );
  }

  // Tool-specific completed states
  const toolName = toolCall.toolName;
  const metadata = getToolMetadata(toolName);

  // read_file: show "Read"
  if (toolName === 'read_file') {
    return 'Read';
  }

  // write_to_file: show diff stats with color
  if (toolName === 'write_to_file') {
    if (toolCall.result?.success && toolCall.result.data) {
      const data = toolCall.result.data as {
        oldContent?: string | null;
        newContent?: string;
        originalContent?: string;
      };

      const oldContent = data.oldContent ?? data.originalContent ?? null;
      const newContent = data.newContent;

      if (newContent !== undefined) {
        const { additions, deletions } = calculateDiffStats(oldContent, newContent);
        return (
          <span className="flex gap-1.5">
            {additions > 0 && (
              <span style={{ color: 'var(--vscode-gitDecoration-addedResourceForeground)' }}>
                +{additions}
              </span>
            )}
            {deletions > 0 && (
              <span style={{ color: 'var(--vscode-gitDecoration-deletedResourceForeground)' }}>
                -{deletions}
              </span>
            )}
            {additions === 0 && deletions === 0 && 'No changes'}
          </span>
        );
      }
    }
    // Fallback when there is no diff data yet: keep animated "Writing" wave
    return renderWaveLabel('Writing');
  }

  // apply_diff: show diff stats with color
  if (toolName === 'apply_diff') {
    if (toolCall.result?.success && toolCall.result.data) {
      const data = toolCall.result.data as {
        oldContent?: string | null;
        newContent?: string;
      };

      const oldContent = data.oldContent ?? null;
      const newContent = data.newContent;

      if (newContent !== undefined && oldContent !== undefined) {
        const { additions, deletions } = calculateDiffStats(oldContent, newContent);
        return (
          <span className="flex gap-1.5">
            {additions > 0 && (
              <span style={{ color: 'var(--vscode-gitDecoration-addedResourceForeground)' }}>
                +{additions}
              </span>
            )}
            {deletions > 0 && (
              <span style={{ color: 'var(--vscode-gitDecoration-deletedResourceForeground)' }}>
                -{deletions}
              </span>
            )}
            {additions === 0 && deletions === 0 && 'No changes'}
          </span>
        );
      }
    }
    // Fallback when there is no diff data yet: keep animated "Editing" wave
    return renderWaveLabel('Editing');
  }

  // todo_write, todo_read: show todo count
  if (toolName === 'todo_write' || toolName === 'todo_read') {
    if (toolCall.result?.success && toolCall.result.data) {
      const data = toolCall.result.data as { tasks?: Array<{ status: string }> };
      const tasks = data.tasks || [];
      const completed = tasks.filter((t) => t.status === 'completed').length;
      return `${completed}/${tasks.length}`;
    }
    return 'Todo';
  }

  // plan: show mode-based status (Created, Updated, Handoff)
  // But if user clicked an action button, show that status instead
  if (toolName === 'plan') {
    // Check if user has taken an action (clicked Verify Plan or Start Implementation)
    const resultData = toolCall.result?.data as { userAction?: string } | undefined;
    const userAction = resultData?.userAction;
    
    if (userAction) {
      const userActionDisplayNames: Record<string, string> = {
        verify_plan: 'Verified',
        start_implementation: 'Started',
        continue: 'Continued',
      };
      return userActionDisplayNames[userAction] || 'Plan';
    }
    
    const mode = toolCall.parameters.mode as PlanMode | undefined;
    const modeDisplayNames: Record<PlanMode, string> = {
      create_plan: 'Created',
      update_plan: 'Updated',
      handoff: 'Handoff',
    };
    return mode ? modeDisplayNames[mode] : 'Plan';
  }

  // run_terminal: show "Successful" when completed
  if (toolName === 'run_terminal') {
    return 'Successful';
  }

  // Other tools: show tool name from metadata
  const displayName = metadata?.name || toolName;
  // Shorten common tool names
  const shortName = displayName
    .replace('List Files', 'List')
    .replace('Grep Search', 'Grep')
    .replace('Delete File', 'Delete');

  return shortName;
}
