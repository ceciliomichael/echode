import { X } from 'lucide-react';
import { DiffViewer } from '../diff-viewer';
import { renderToolResult } from '../tool-result-renderer';
import { EchoSearchProgressIndicator } from './echo-search-progress';
import { PlanToolActions } from './plan-tool-actions';
import type { ToolCall } from '../../../types/tool';
import type { ToolFileInfo } from '../../../utils/tool-file-info';

interface ToolBlockContentProps {
  toolCall: ToolCall;
  fileInfo: ToolFileInfo;
  isExpanded: boolean;
  messageId: string;
}

export function ToolBlockContent({ toolCall, fileInfo, isExpanded, messageId }: ToolBlockContentProps) {
  const isAborted = toolCall.status === 'aborted';
  const isAwaitingUser = toolCall.status === 'awaiting_user';
  const isPlanTool = toolCall.toolName === 'plan';
  
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

  // Plan tool with awaiting_user status or completed with action should always show content
  const shouldRenderInnerContent = isExpanded || isStreamingPhase || showPlanActions;

  return (
    <div
      className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${
        isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
      }`}
    >
      {shouldRenderInnerContent && (
        <div className="border-t" style={{ borderColor: 'var(--vscode-input-border)' }}>
          {/* Processing indicator or Real-time Streaming */}
          {isStreamingPhase && (
            <>
              {toolCall.toolName === 'write_to_file' && toolCall.parameters.content ? (
                <div className="px-3 py-3">
                  <DiffViewer
                    oldContent={undefined}
                    newContent={toolCall.parameters.content as string}
                    fileName={fileInfo.displayName}
                    isStreaming={!isAborted}
                    viewOnly={true}
                  />
                </div>
              ) : toolCall.toolName === 'echo_search' ? (
                <div className="px-3 py-3">
                  <EchoSearchProgressIndicator 
                    progress={toolCall.progress || { iteration: 0, toolsIteration: 0, maxIterations: 4, phase: 'starting', tools: [], message: '' }} 
                    isAborted={isAborted} 
                  />
                </div>
              ) : null}
            </>
          )}

          {/* Result - only show if not aborted (aborted handled above) */}
          {toolCall.result && !isAborted && (
            <div className="overflow-x-auto">
              {toolCall.result.success ? (
                <div style={{ color: 'var(--vscode-editor-foreground)' }}>
                  {renderToolResult(toolCall.toolName, toolCall.result.data, fileInfo.displayName)}
                  
                  {/* Plan tool action buttons */}
                  {showPlanActions && (
                    <div className="px-3 pb-3">
                      <PlanToolActions toolCall={toolCall} messageId={messageId} />
                    </div>
                  )}
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
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
