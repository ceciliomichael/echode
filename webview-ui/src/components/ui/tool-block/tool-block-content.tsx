import { X } from 'lucide-react';
import { DiffViewer } from '../diff-viewer';
import { renderToolResult } from '../tool-result-renderer';
import { EchoSearchProgressIndicator } from './echo-search-progress';
import { PlanToolActions } from './plan-tool-actions';
import { PublishFindingsActions } from './publish-findings-actions';
import type { ToolCall } from '../../../types/tool';
import type { ToolFileInfo } from '../../../utils/tool-file-info';
import type { ChatMode } from '../../../types/chat-mode';
import type { WorkspaceContext } from '../../../types/workspace';

interface ToolBlockContentProps {
  toolCall: ToolCall;
  fileInfo: ToolFileInfo;
  isExpanded: boolean;
  messageId: string;
  isLastMessage?: boolean;
  mode?: ChatMode;
  workspace?: WorkspaceContext | null;
}

export function ToolBlockContent({ toolCall, fileInfo, isExpanded, messageId, isLastMessage = true, mode, workspace }: ToolBlockContentProps) {
  const isAborted = toolCall.status === 'aborted';
  const isAwaitingUser = toolCall.status === 'awaiting_user';
  const isPlanTool = toolCall.toolName === 'plan';
  const isPublishFindingsTool = toolCall.toolName === 'publish_findings';

  // Check if we have streamed content to preserve
  const hasStreamedContent =
    (toolCall.toolName === 'write_to_file' && toolCall.parameters.content) ||
    (toolCall.toolName === 'echo_search');

  const isStreamingPhase =
    (toolCall.status === 'executing' || toolCall.status === 'pending' || (isAborted && hasStreamedContent)) &&
    !toolCall.result?.success;

  // Check for plan tool completion with user action
  const planResult = isPlanTool ? toolCall.result?.data as { userAction?: string } | undefined : undefined;
  const hasPlanUserAction = !!planResult?.userAction;
  const showPlanActions = isPlanTool && (isAwaitingUser || (toolCall.status === 'completed' && hasPlanUserAction));

  // Check for publish_findings tool - show actions when awaiting_user or completed (no user action yet)
  const publishFindingsResult = isPublishFindingsTool ? toolCall.result?.data as { userAction?: string } | undefined : undefined;
  const hasPublishFindingsUserAction = !!publishFindingsResult?.userAction;
  const isPublishFindingsAwaitingUser = isPublishFindingsTool && toolCall.status === 'awaiting_user';
  const isPublishFindingsCompletedWithAction = isPublishFindingsTool && toolCall.status === 'completed' && hasPublishFindingsUserAction;
  const showPublishFindingsActions = (isPublishFindingsAwaitingUser || isPublishFindingsCompletedWithAction) && toolCall.result?.success;

  // Plan tool with awaiting_user status or completed with action should always show content
  // Also show content for publish_findings when actions are available
  const shouldRenderInnerContent = isExpanded || isStreamingPhase || showPlanActions || showPublishFindingsActions;

  return (
    <div
      className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
    >
      {shouldRenderInnerContent && (
        <div className="border-t max-h-[400px] flex flex-col" style={{ borderColor: 'var(--vscode-input-border)' }}>
          {/* Processing indicator or Real-time Streaming */}
          {isStreamingPhase && (
            <>
              {toolCall.toolName === 'write_to_file' && toolCall.parameters.content ? (
                <div className="px-3 py-3 flex-1 min-h-0 flex flex-col overflow-hidden">
                  <DiffViewer
                    oldContent={undefined}
                    newContent={toolCall.parameters.content as string}
                    fileName={fileInfo.displayName}
                    isStreaming={!isAborted}
                    viewOnly={true}
                  />
                </div>
              ) : toolCall.toolName === 'echo_search' ? (
                <div className="px-3 py-3 overflow-y-auto">
                  <EchoSearchProgressIndicator
                    progress={(toolCall.progress as any) || { iteration: 0, toolsIteration: 0, maxIterations: 4, phase: 'starting', tools: [], message: '' }}
                    isAborted={isAborted}
                  />
                </div>
              ) : toolCall.toolName === 'run_terminal' ? (
                <div className="px-3 py-3 overflow-hidden">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold opacity-70 flex items-center gap-1">
                      <span>Terminal Output</span>
                      {toolCall.status === 'executing' && !toolCall.progress && (
                        <span className="ml-1 animate-pulse">•</span>
                      )}
                    </div>
                    <pre
                      className="text-xs font-mono whitespace-pre-wrap break-all p-2 rounded"
                      style={{
                        backgroundColor: 'var(--vscode-textCodeBlock-background)',
                        color: 'var(--vscode-editor-foreground)',
                        maxHeight: '300px',
                        overflowY: 'auto'
                      }}
                    >
                      {typeof toolCall.progress === 'string' && toolCall.progress
                        ? toolCall.progress
                        : <span className="opacity-50 italic">Waiting for output...</span>}
                    </pre>
                  </div>
                </div>
              ) : null}
            </>
          )}

          {/* Result - only show if not aborted (aborted handled above) */}
          {toolCall.result && !isAborted && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* For run_terminal, always use the normal renderer (even on failure) to show full output */}
              {toolCall.toolName === 'run_terminal' ? (
                <div className="flex-1 min-h-0 flex flex-col" style={{ color: 'var(--vscode-editor-foreground)' }}>
                  {renderToolResult(
                    toolCall.toolName,
                    { ...toolCall.result.data as object, progress: toolCall.progress },
                    fileInfo.displayName,
                    workspace
                  )}
                </div>
              ) : toolCall.result.success ? (
                <div className="flex-1 min-h-0 flex flex-col" style={{ color: 'var(--vscode-editor-foreground)' }}>
                  {renderToolResult(toolCall.toolName, toolCall.result.data, fileInfo.displayName, workspace)}

                  {/* Plan tool action buttons */}
                  {showPlanActions && (
                    <div className="px-3 pb-3">
                      <PlanToolActions toolCall={toolCall} messageId={messageId} isLastMessage={isLastMessage} mode={mode} />
                    </div>
                  )}

                  {/* Publish findings action buttons */}
                  {showPublishFindingsActions && (
                    <div className="px-3 pb-3">
                      <PublishFindingsActions toolCall={toolCall} messageId={messageId} isLastMessage={isLastMessage} mode={mode} />
                    </div>
                  )}
                </div>
              ) : (
                toolCall.status === 'rejected' ||
                  toolCall.result.error?.includes('REJECTED_BY_USER') ||
                  toolCall.result.error?.toLowerCase().includes('rejected by user') ? (
                  <div
                    className="px-3 py-3"
                    style={{
                      backgroundColor: 'var(--vscode-inputValidation-infoBackground)',
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-sm font-semibold mb-1"
                          style={{ color: 'var(--vscode-descriptionForeground)' }}
                        >
                          Action Cancelled
                        </div>
                        <div
                          className="text-sm break-words whitespace-pre-wrap"
                          style={{ color: 'var(--vscode-descriptionForeground)' }}
                        >
                          User rejected this action.
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="px-3 py-3"
                    style={{
                      backgroundColor: 'var(--vscode-inputValidation-errorBackground)',
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <X
                        className="w-3.5 h-3.5 mt-0.5 shrink-0"
                        style={{ color: 'var(--vscode-errorForeground)' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-sm font-semibold mb-1"
                          style={{ color: 'var(--vscode-errorForeground)' }}
                        >
                          Error
                        </div>
                        <div
                          className="text-sm break-words whitespace-pre-wrap"
                          style={{ color: 'var(--vscode-errorForeground)' }}
                        >
                          {toolCall.result.error?.split('\n\n')[0]}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
