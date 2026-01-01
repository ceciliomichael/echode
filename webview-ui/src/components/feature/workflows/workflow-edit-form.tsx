import { Pencil, Save, Trash2, X } from 'lucide-react';
import type { Workflow } from '../../../types/workflow';

interface WorkflowEditFormProps {
  workflow: Workflow;
  content: string;
  isSaving: boolean;
  error: string | null;
  onContentChange: (content: string) => void;
  onSave: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

export function WorkflowEditForm({
  workflow,
  content,
  isSaving,
  error,
  onContentChange,
  onSave,
  onDelete,
  onCancel
}: WorkflowEditFormProps) {
  const sourceLabel = workflow.source === 'global' ? 'Global' : 'Workspace';

  return (
    <div 
      className="p-4 rounded-xl border flex flex-col"
      style={{
        backgroundColor: 'var(--vscode-editor-background)',
        borderColor: 'var(--vscode-focusBorder)',
        height: 'calc(100vh - 220px)',
        minHeight: '400px'
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Pencil size={14} style={{ color: 'var(--vscode-foreground)' }} />
          <h3 
            className="text-sm font-medium"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            Editing: {workflow.name}
          </h3>
          <span 
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ 
              backgroundColor: workflow.source === 'global' 
                ? 'var(--vscode-charts-purple)' 
                : 'var(--vscode-charts-blue)',
              color: 'var(--vscode-button-foreground)',
              opacity: 0.8
            }}
          >
            {sourceLabel}
          </span>
        </div>
        <button
          onClick={onCancel}
          className="p-1 rounded transition-colors hover:bg-opacity-10"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Content Textarea */}
      <div className="flex-1 flex flex-col space-y-1.5 min-h-0">
        <label 
          className="block text-xs font-medium shrink-0"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          Content (Markdown)
        </label>
        <textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder="Enter your workflow prompt content here..."
          className="flex-1 w-full px-3 py-2 text-sm rounded-xl border resize-none font-mono overflow-y-auto"
          style={{
            backgroundColor: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            borderColor: 'var(--vscode-input-border)'
          }}
        />
      </div>

      {/* Error Message */}
      {error && (
        <p 
          className="text-xs mt-2"
          style={{ color: 'var(--vscode-errorForeground)' }}
        >
          {error}
        </p>
      )}

      {/* Action Buttons */}
      <div 
        className="flex items-center justify-between mt-4 pt-4 border-t shrink-0" 
        style={{ borderColor: 'var(--vscode-panel-border)' }}
      >
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-colors"
          style={{
            backgroundColor: 'transparent',
            color: 'var(--vscode-errorForeground)',
            borderColor: 'var(--vscode-errorForeground)'
          }}
        >
          <Trash2 size={14} />
          Delete Workflow
        </button>
        <button
          onClick={onSave}
          disabled={isSaving || !content.trim()}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl border transition-colors disabled:opacity-50"
          style={{
            backgroundColor: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            borderColor: 'var(--vscode-button-background)'
          }}
        >
          <Save size={14} />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}