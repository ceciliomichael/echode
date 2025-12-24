import { LoadingDots } from '../loading-dots';
import type { ToolExecutionState } from '../../../types/tool';
import type { ContentToken } from '../../../utils/content-tokenizer';

interface LoadingIndicatorProps {
  isStreaming: boolean;
  tokens: ContentToken[];
  visibleTokens: ContentToken[];
  toolExecutions?: Map<string, ToolExecutionState>;
}

/**
 * Renders loading dots based on streaming state and token visibility.
 * Handles complex logic for when to show/hide the loading indicator.
 */
export function LoadingIndicator({
  isStreaming,
  tokens,
  visibleTokens,
  toolExecutions,
}: LoadingIndicatorProps) {
  if (!isStreaming) {
    return null;
  }

  // Check if there are filtered tool blocks (file modification tools missing path, or tools without name)
  const hasFilteredToolBlocks = tokens.some((token) => {
    if (token.type !== 'tool') return false;
    // Tool without a valid name is filtered
    if (!token.toolName || token.toolName.trim() === '') {
      return true;
    }
    // Check if path is missing for file modification tools
    const isFileModificationTool =
      token.toolName === 'write_to_file' || token.toolName === 'apply_diff';
    if (isFileModificationTool) {
      const path = token.parameters.path as string | undefined;
      return !path || path.trim() === '';
    }
    return false;
  });

  // Track whether any VISIBLE tool tokens exist in the current content
  const hasVisibleToolToken = visibleTokens.some((token) => token.type === 'tool');

  // If any tool executions are still active (pending/executing) AND we already have
  // at least one visible tool token, we're in the visible tool phase and should let the
  // ToolBlock handle its own status UI instead of showing extra loading dots.
  const hasActiveToolExecutions = Array.from(toolExecutions?.values() || []).some(
    (state) =>
      state.status === 'pending' ||
      state.status === 'executing' ||
      state.status === 'fetching_diagnostics'
  );
  if (hasActiveToolExecutions && hasVisibleToolToken) {
    return null;
  }

  // If there are visible tokens, check the last one
  if (visibleTokens.length > 0) {
    const lastToken = visibleTokens[visibleTokens.length - 1];

    // PRIORITY: If there are filtered tool blocks (streaming but not yet closed),
    // show loading dots regardless of what the last visible token is
    if (hasFilteredToolBlocks) {
      return (
        <div className="mt-2" style={{ paddingLeft: '1.25rem', paddingRight: '1.25rem' }}>
          <LoadingDots label="Thinking" />
        </div>
      );
    }

    // If the last visible content is text and no tools are streaming,
    // rely on the streaming text itself as the progress indicator
    if (lastToken.type === 'text') {
      return null;
    }

    // Case 1: Tool block - only show dots if completed/error/aborted (waiting for AI)
    // Do NOT show if executing (ToolBlock shows status) or incomplete
    if (lastToken.type === 'tool' && lastToken.isClosed) {
      const status = toolExecutions?.get(lastToken.toolExecutionId)?.status;

      // Special check for multi-file read_file: wait for all files to complete diagnostics
      const executionState = toolExecutions?.get(lastToken.toolExecutionId);
      if (
        lastToken.toolName === 'read_file' &&
        executionState?.result?.success &&
        executionState.result.data
      ) {
        const resultData = executionState.result.data as Record<string, unknown>;
        if (
          'files' in resultData &&
          Array.isArray(resultData.files) &&
          resultData.files.length > 1
        ) {
          // Check if all split file executions are done with diagnostics
          const files = resultData.files as Array<unknown>;
          const allFilesCompleted = files.every((_, fileIdx) => {
            const fileStatus = toolExecutions?.get(
              `${lastToken.toolExecutionId}-file-${fileIdx}`
            )?.status;
            return (
              fileStatus === 'completed' ||
              fileStatus === 'error' ||
              fileStatus === 'aborted'
            );
          });

          if (allFilesCompleted) {
            return (
              <div
                className="mt-2"
                style={{ paddingLeft: '1.25rem', paddingRight: '1.25rem' }}
              >
                <LoadingDots label="Thinking" />
              </div>
            );
          }
          // Still linting, don't show loading dots yet
          return null;
        }
      }

      // Normal single-tool case
      if (status === 'completed' || status === 'error' || status === 'aborted') {
        return (
          <div
            className="mt-2"
            style={{ paddingLeft: '1.25rem', paddingRight: '1.25rem' }}
          >
            <LoadingDots label="Thinking" />
          </div>
        );
      }
    }

    // Case 2: Think block - show dots after thinking has completed (closed)
    // and no tools are yet visible. While the think block itself is streaming,
    // it already acts as the primary progress indicator so we avoid extra dots.
    if (lastToken.type === 'think' && lastToken.isClosed && !hasVisibleToolToken) {
      return (
        <div
          className="mt-2"
          style={{ paddingLeft: '1.25rem', paddingRight: '1.25rem' }}
        >
          <LoadingDots label="Thinking" />
        </div>
      );
    }
  } else if (tokens.length > 0) {
    // Case 4: Have tokens but all filtered (incomplete tool blocks or empty think) - show loading dots
    return (
      <div style={{ paddingLeft: '1.25rem', paddingRight: '1.25rem' }}>
        <LoadingDots label="Thinking" />
      </div>
    );
  }

  return null;
}