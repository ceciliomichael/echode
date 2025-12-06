import { X } from 'lucide-react';
import { DiffViewer } from '../diff-viewer';
import { renderToolResult } from '../tool-result-renderer';
import { EchoSearchProgressIndicator } from './echo-search-progress';
import type { ToolCall } from '../../../types/tool';
import type { ToolFileInfo } from '../../../utils/tool-file-info';

interface ToolBlockContentProps {
  toolCall: ToolCall;
  fileInfo: ToolFileInfo;
  isExpanded: boolean;
}

export function ToolBlockContent({ toolCall, fileInfo, isExpanded }: ToolBlockContentProps) {
  const isAborted = toolCall.status === 'aborted';
  
  // Check if we have streamed content to preserve
  // For echo_search, always preserve on abort (even without progress)
  const hasStreamedContent = 
    (toolCall.toolName === 'write_to_file' && toolCall.parameters.content) ||
    (toolCall.toolName === 'echo_search' && (toolCall.progress || isAborted));

  return (
    <div
      className={`overflow-hidden transition-all duration-300 ease-in-out ${
        isExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'
      }`}
    >
      <div className="border-t" style={{ borderColor: 'var(--vscode-input-border)' }}>
        {/* Processing indicator or Real-time Streaming */}
        {((toolCall.status === 'executing' || toolCall.status === 'pending' || (isAborted && hasStreamedContent)) &&
          !toolCall.result?.success) && (
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
              ) : toolCall.toolName === 'echo_search' && (toolCall.progress || isAborted) ? (
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
    </div>
  );
}
