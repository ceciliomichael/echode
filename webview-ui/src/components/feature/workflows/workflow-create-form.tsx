import { Save, X } from 'lucide-react';
import type { WorkflowSource } from '../../../types/workflow';

interface WorkflowCreateFormProps {
  title: string;
  content: string;
  source: WorkflowSource;
  isSaving: boolean;
  error: string | null;
  hasWorkspace: boolean;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  onSourceChange: (source: WorkflowSource) => void;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * Convert a string to kebab-case for filename preview
 */
function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function WorkflowCreateForm({
  title,
  content,
  source,
  isSaving,
  error,
  hasWorkspace,
  onTitleChange,
  onContentChange,
  onSourceChange,
  onSave,
  onCancel
}: WorkflowCreateFormProps) {
  const previewFilename = toKebabCase(title);

  return (
    <div 
      className="p-4 rounded-xl border space-y-4"
      style={{
        backgroundColor: 'var(--vscode-editor-background)',
        borderColor: 'var(--vscode-panel-border)'
      }}
    >
      <div className="flex items-center justify-between">
        <h3 
          className="text-sm font-medium"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          Create New Workflow
        </h3>
        <button
          onClick={onCancel}
          className="p-1 rounded transition-colors hover:bg-opacity-10"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Title Input */}
      <div className="space-y-1.5">
        <label 
          className="block text-xs font-medium"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="e.g., Code Review, Bug Fix Template"
          className="w-full px-3 py-2 text-sm rounded-xl border"
          style={{
            backgroundColor: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            borderColor: 'var(--vscode-input-border)'
          }}
        />
        {previewFilename && (
          <p 
            className="text-xs"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
          >
            Filename: <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--vscode-textCodeBlock-background)' }}>{previewFilename}.md</code>
          </p>
        )}
      </div>

      {/* Save Location */}
      <div className="space-y-1.5">
        <label 
          className="block text-xs font-medium"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          Save to
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSourceChange('workspace')}
            disabled={!hasWorkspace}
            className="flex-1 px-3 py-2 text-xs font-medium rounded-xl border transition-colors disabled:opacity-50"
            style={{
              backgroundColor: source === 'workspace' 
                ? 'var(--vscode-button-background)' 
                : 'transparent',
              color: source === 'workspace' 
                ? 'var(--vscode-button-foreground)' 
                : 'var(--vscode-foreground)',
              borderColor: source === 'workspace' 
                ? 'var(--vscode-button-background)' 
                : 'var(--vscode-panel-border)'
            }}
          >
            Workspace
          </button>
          <button
            type="button"
            onClick={() => onSourceChange('global')}
            className="flex-1 px-3 py-2 text-xs font-medium rounded-xl border transition-colors"
            style={{
              backgroundColor: source === 'global' 
                ? 'var(--vscode-button-background)' 
                : 'transparent',
              color: source === 'global' 
                ? 'var(--vscode-button-foreground)' 
                : 'var(--vscode-foreground)',
              borderColor: source === 'global' 
                ? 'var(--vscode-button-background)' 
                : 'var(--vscode-panel-border)'
            }}
          >
            Global
          </button>
        </div>
        <p 
          className="text-xs"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          {source === 'workspace' 
            ? 'Saved to .echode/workflows in this project' 
            : 'Saved to ~/.echode/workflows (available in all projects)'}
        </p>
      </div>

      {/* Content Textarea */}
      <div className="space-y-1.5">
        <label 
          className="block text-xs font-medium"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          Content (Markdown)
        </label>
        <textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder="Enter your workflow prompt content here..."
          className="w-full px-3 py-2 text-sm rounded-xl border resize-none font-mono overflow-y-auto"
          style={{
            backgroundColor: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            borderColor: 'var(--vscode-input-border)',
            height: 'calc(100vh - 520px)',
            minHeight: '200px'
          }}
        />
      </div>

      {/* Error Message */}
      {error && (
        <p 
          className="text-xs"
          style={{ color: 'var(--vscode-errorForeground)' }}
        >
          {error}
        </p>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={onSave}
          disabled={isSaving || !title.trim() || !content.trim()}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl border transition-colors disabled:opacity-50"
          style={{
            backgroundColor: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            borderColor: 'var(--vscode-button-background)'
          }}
        >
          <Save size={14} />
          {isSaving ? 'Saving...' : 'Save Workflow'}
        </button>
      </div>
    </div>
  );
}