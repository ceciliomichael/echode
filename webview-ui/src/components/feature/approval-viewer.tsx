import { useCallback } from 'react';
import { DiffViewer } from '../ui/diff-viewer';
import { Button } from '../ui/button';
import type { ApprovalData } from '../../App';

/**
 * ApprovalViewer - Manual Mode tool approval interface
 * 
 * Displays a side-by-side diff viewer for file changes or command preview for terminal commands.
 * User must explicitly approve or reject before the tool executes.
 * Supports queued approvals for parallel tool executions.
 */
export function ApprovalViewer() {
  const approvalData = window.approvalData as ApprovalData | undefined;
  
  const hasQueue = (approvalData?.queueTotal ?? 1) > 1;
  const queuePosition = approvalData?.queuePosition ?? 1;
  const queueTotal = approvalData?.queueTotal ?? 1;

  const handleApprove = useCallback(() => {
    if (!approvalData?.requestId) return;
    
    window.vscode?.postMessage({
      type: 'approveTool',
      requestId: approvalData.requestId,
    });
  }, [approvalData?.requestId]);

  const handleReject = useCallback(() => {
    if (!approvalData?.requestId) return;
    
    window.vscode?.postMessage({
      type: 'rejectTool',
      requestId: approvalData.requestId,
    });
  }, [approvalData?.requestId]);

  const handleRejectAll = useCallback(() => {
    window.vscode?.postMessage({
      type: 'rejectAllTools',
    });
  }, []);

  if (!approvalData) {
    return (
      <div className="h-screen flex items-center justify-center p-6">
        <div 
          className="text-center p-8 rounded-xl border"
          style={{
            backgroundColor: 'var(--vscode-editor-background)',
            borderColor: 'var(--vscode-panel-border)',
          }}
        >
          <EmptyIcon />
          <p 
            className="mt-3 text-sm"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
          >
            No approval pending
          </p>
        </div>
      </div>
    );
  }

  const isFileChange = !!approvalData.diff;
  const isTerminalCommand = !!approvalData.command;

  return (
    <div 
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--vscode-editor-background)' }}
    >
      {/* Header */}
      <header 
        className="flex-shrink-0 px-5 py-4 border-b"
        style={{ borderColor: 'var(--vscode-panel-border)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--vscode-badge-background)' }}
            >
              <ShieldIcon />
            </div>
            <div>
              <h1 
                className="text-base font-semibold"
                style={{ color: 'var(--vscode-foreground)' }}
              >
                {approvalData.title}
              </h1>
              <p 
                className="text-xs mt-0.5"
                style={{ color: 'var(--vscode-descriptionForeground)' }}
              >
                {approvalData.message}
              </p>
            </div>
          </div>
          
          {/* Queue indicator */}
          {hasQueue && (
            <div 
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{
                backgroundColor: 'var(--vscode-badge-background)',
                color: 'var(--vscode-badge-foreground)',
              }}
            >
              <QueueIcon />
              <span>{queuePosition} of {queueTotal}</span>
            </div>
          )}
        </div>
      </header>

      {/* Content - flex container, children handle their own scrolling */}
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden p-5">
        {/* File Diff View - fills available space, single scrollbar inside DiffViewer */}
        {isFileChange && approvalData.diff && (
          <DiffViewer
            oldContent={approvalData.diff.oldContent}
            newContent={approvalData.diff.newContent}
            fileName={approvalData.diff.fileName}
          />
        )}

        {/* Terminal Command View */}
        {isTerminalCommand && (
          <div 
            className="flex-1 min-h-0 rounded-xl border overflow-hidden flex flex-col"
            style={{ borderColor: 'var(--vscode-panel-border)' }}
          >
            <div 
              className="flex items-center gap-2 px-4 py-3 border-b"
              style={{
                backgroundColor: 'var(--vscode-editor-background)',
                borderColor: 'var(--vscode-panel-border)',
              }}
            >
              <TerminalIcon />
              <span 
                className="text-sm font-medium"
                style={{ color: 'var(--vscode-foreground)' }}
              >
                Terminal Command
              </span>
            </div>
            <div 
              className="flex-1 p-4 overflow-auto"
              style={{ backgroundColor: 'var(--vscode-terminal-background)' }}
            >
              <pre 
                className="font-mono text-sm leading-relaxed m-0"
                style={{ color: 'var(--vscode-terminal-foreground)' }}
              >
                <span style={{ color: 'var(--vscode-terminal-ansiGreen)' }}>$</span> {approvalData.command}
              </pre>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer 
        className="flex-shrink-0 px-5 py-4 border-t"
        style={{ 
          borderColor: 'var(--vscode-panel-border)',
          backgroundColor: 'var(--vscode-editor-background)' 
        }}
      >
        <div className="flex items-center justify-between">
          {/* Left side - Reject All */}
          <div>
            {hasQueue && (
              <Button onClick={handleRejectAll} variant="secondary">
                <XIcon size={14} />
                Reject All ({queueTotal})
              </Button>
            )}
          </div>

          {/* Right side - Main actions */}
          <div className="flex items-center gap-3">
            <Button onClick={handleReject} variant="secondary">
              {hasQueue ? 'Skip' : 'Reject'}
            </Button>
            <Button onClick={handleApprove}>
              <CheckIcon size={16} />
              Approve
            </Button>
          </div>
        </div>
        
        {/* Queue progress bar */}
        {hasQueue && (
          <div className="mt-3">
            <div 
              className="h-1 rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--vscode-progressBar-background)' }}
            >
              <div 
                className="h-full rounded-full transition-all duration-300"
                style={{ 
                  width: `${(queuePosition / queueTotal) * 100}%`,
                  backgroundColor: 'var(--vscode-progressBar-background)',
                }}
              />
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}

/* Icons */

function ShieldIcon() {
  return (
    <svg 
      width="20" 
      height="20" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      style={{ color: 'var(--vscode-badge-foreground)' }}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function QueueIcon() {
  return (
    <svg 
      width="14" 
      height="14" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2"
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg 
      width="16" 
      height="16" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2"
      strokeLinecap="round" 
      strokeLinejoin="round"
      style={{ color: 'var(--vscode-terminal-ansiGreen)' }}
    >
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5"
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2"
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function EmptyIcon() {
  return (
    <svg 
      width="48" 
      height="48" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.5"
      strokeLinecap="round" 
      strokeLinejoin="round"
      style={{ color: 'var(--vscode-descriptionForeground)', opacity: 0.5 }}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
    </svg>
  );
}
