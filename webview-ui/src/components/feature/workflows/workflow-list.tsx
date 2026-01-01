import { FileText, Pencil } from 'lucide-react';
import type { Workflow, WorkflowSource } from '../../../types/workflow';

interface WorkflowListProps {
  title: string;
  workflows: Workflow[];
  source: WorkflowSource;
  onEdit: (workflow: Workflow) => void;
  emptyMessage?: string;
}

export function WorkflowList({ 
  title, 
  workflows, 
  source, 
  onEdit,
  emptyMessage = 'No workflows found'
}: WorkflowListProps) {
  const filteredWorkflows = workflows.filter(w => w.source === source);
  
  if (filteredWorkflows.length === 0) {
    return (
      <div className="space-y-2">
        <h3 
          className="text-xs font-medium uppercase tracking-wide"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          {title} (0)
        </h3>
        <p 
          className="text-xs py-3 px-4 rounded-xl border"
          style={{ 
            color: 'var(--vscode-descriptionForeground)',
            backgroundColor: 'var(--vscode-editor-background)',
            borderColor: 'var(--vscode-panel-border)'
          }}
        >
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 
        className="text-xs font-medium uppercase tracking-wide"
        style={{ color: 'var(--vscode-descriptionForeground)' }}
      >
        {title} ({filteredWorkflows.length})
      </h3>
      <div className="space-y-2">
        {filteredWorkflows.map((workflow) => (
          <div
            key={`${workflow.source}-${workflow.name}`}
            className="p-3 rounded-xl border cursor-pointer transition-colors"
            style={{
              backgroundColor: 'var(--vscode-editor-background)',
              borderColor: 'var(--vscode-panel-border)',
              color: 'var(--vscode-foreground)'
            }}
            onClick={() => onEdit(workflow)}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
              e.currentTarget.style.borderColor = 'var(--vscode-focusBorder)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--vscode-editor-background)';
              e.currentTarget.style.borderColor = 'var(--vscode-panel-border)';
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={14} className="shrink-0" />
                <span className="text-sm font-medium">{workflow.name}</span>
              </div>
              <Pencil size={14} style={{ color: 'var(--vscode-descriptionForeground)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}