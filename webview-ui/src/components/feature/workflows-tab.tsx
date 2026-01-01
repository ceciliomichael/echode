import { useState, useEffect, useCallback } from 'react';
import { Plus, FileText } from 'lucide-react';
import { vscode } from '../../utils/vscode';
import type { 
  Workflow, 
  WorkflowSource, 
  WorkflowsListMessage, 
  WorkflowSavedMessage, 
  WorkflowDeletedMessage 
} from '../../types/workflow';
import { WorkflowList } from './workflows/workflow-list';
import { WorkflowCreateForm } from './workflows/workflow-create-form';
import { WorkflowEditForm } from './workflows/workflow-edit-form';

export function WorkflowsTab() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Track if workspace is available
  const [hasWorkspace, setHasWorkspace] = useState(true);
  
  // Form state for creating new workflows
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newSource, setNewSource] = useState<WorkflowSource>('workspace');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Edit state for existing workflows
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editSaveError, setEditSaveError] = useState<string | null>(null);

  // Fetch workflows on mount
  const fetchWorkflows = useCallback(() => {
    setIsLoading(true);
    setError(null);
    vscode.postMessage({ type: 'getWorkflows' });
  }, []);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  // Listen for messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      switch (message.type) {
        case 'workflowsList': {
          const data = message as WorkflowsListMessage;
          setWorkflows(data.workflows || []);
          setError(data.error || null);
          setIsLoading(false);
          
          // Check if workspace is available based on workflow sources
          // If we have any workspace workflows or no error about workspace, it's available
          const hasWorkspaceWorkflows = data.workflows?.some(w => w.source === 'workspace');
          const noWorkspaceError = !data.error?.includes('No workspace');
          setHasWorkspace(hasWorkspaceWorkflows || noWorkspaceError);
          break;
        }
        case 'workflowSaved': {
          const data = message as WorkflowSavedMessage;
          setIsSaving(false);
          setIsEditSaving(false);
          if (data.success) {
            // Reset create form
            setNewTitle('');
            setNewContent('');
            setNewSource('workspace');
            setIsCreating(false);
            setSaveError(null);
            // Reset edit form
            setEditingWorkflow(null);
            setEditContent('');
            setEditSaveError(null);
            fetchWorkflows();
          } else {
            const errorMsg = data.error || 'Failed to save workflow';
            if (isCreating) {
              setSaveError(errorMsg);
            } else {
              setEditSaveError(errorMsg);
            }
          }
          break;
        }
        case 'workflowDeleted': {
          const data = message as WorkflowDeletedMessage;
          if (data.success) {
            if (editingWorkflow?.name === data.name && editingWorkflow?.source === data.source) {
              setEditingWorkflow(null);
              setEditContent('');
            }
            fetchWorkflows();
          }
          break;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchWorkflows, editingWorkflow, isCreating]);

  // Handlers for create form
  const handleSave = () => {
    if (!newTitle.trim() || !newContent.trim()) {
      setSaveError('Both title and content are required');
      return;
    }
    
    setIsSaving(true);
    setSaveError(null);
    vscode.postMessage({
      type: 'saveWorkflow',
      name: newTitle,
      content: newContent,
      source: newSource
    });
  };

  const handleCancel = () => {
    setIsCreating(false);
    setNewTitle('');
    setNewContent('');
    setNewSource('workspace');
    setSaveError(null);
  };

  // Handlers for edit form
  const handleStartEdit = (workflow: Workflow) => {
    setEditingWorkflow(workflow);
    setEditContent(workflow.content);
    setEditSaveError(null);
  };

  const handleEditSave = () => {
    if (!editingWorkflow || !editContent.trim()) {
      setEditSaveError('Content is required');
      return;
    }
    
    setIsEditSaving(true);
    setEditSaveError(null);
    vscode.postMessage({
      type: 'saveWorkflow',
      name: editingWorkflow.name,
      content: editContent,
      source: editingWorkflow.source
    });
  };

  const handleEditCancel = () => {
    setEditingWorkflow(null);
    setEditContent('');
    setEditSaveError(null);
  };

  const handleDelete = () => {
    if (!editingWorkflow) return;
    vscode.postMessage({
      type: 'deleteWorkflow',
      name: editingWorkflow.name,
      source: editingWorkflow.source
    });
  };

  // Computed values
  const hasAnyWorkflows = workflows.length > 0;

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <p 
          className="text-xs"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          Workflows are reusable prompts triggered by slash commands (e.g., <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--vscode-textCodeBlock-background)' }}>/[workflow-name]</code>).
        </p>
        {!isCreating && !editingWorkflow && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-colors shrink-0"
            style={{
              backgroundColor: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
              borderColor: 'var(--vscode-button-background)'
            }}
          >
            <Plus size={14} />
            New Workflow
          </button>
        )}
      </div>

      {/* Create Form */}
      {isCreating && (
        <WorkflowCreateForm
          title={newTitle}
          content={newContent}
          source={newSource}
          isSaving={isSaving}
          error={saveError}
          hasWorkspace={hasWorkspace}
          onTitleChange={setNewTitle}
          onContentChange={setNewContent}
          onSourceChange={setNewSource}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}

      {/* Edit Form */}
      {editingWorkflow && (
        <WorkflowEditForm
          workflow={editingWorkflow}
          content={editContent}
          isSaving={isEditSaving}
          error={editSaveError}
          onContentChange={setEditContent}
          onSave={handleEditSave}
          onDelete={handleDelete}
          onCancel={handleEditCancel}
        />
      )}

      {/* Error State */}
      {error && !error.includes('No workspace') && (
        <div 
          className="p-3 rounded-xl text-sm"
          style={{
            backgroundColor: 'var(--vscode-inputValidation-errorBackground)',
            color: 'var(--vscode-errorForeground)',
            borderColor: 'var(--vscode-inputValidation-errorBorder)'
          }}
        >
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div 
          className="text-center py-8 text-sm"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          Loading workflows...
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !hasAnyWorkflows && !isCreating && (
        <div 
          className="text-center py-12 space-y-3"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          <FileText size={32} className="mx-auto opacity-50" />
          <p className="text-sm">No workflows found</p>
          <p className="text-xs">
            Create a workflow to get started, or add <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--vscode-textCodeBlock-background)' }}>.md</code> files to <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--vscode-textCodeBlock-background)' }}>.echode/workflows/</code>
          </p>
        </div>
      )}

      {/* Workflows Lists */}
      {!isLoading && hasAnyWorkflows && !editingWorkflow && (
        <div className="space-y-6">
          {/* Workspace Workflows */}
          <WorkflowList
            title="Workspace Workflows"
            workflows={workflows}
            source="workspace"
            onEdit={handleStartEdit}
            emptyMessage={hasWorkspace ? "No workspace workflows" : "No workspace open"}
          />

          {/* Global Workflows */}
          <WorkflowList
            title="Global Workflows"
            workflows={workflows}
            source="global"
            onEdit={handleStartEdit}
            emptyMessage="No global workflows (saved to ~/.echode/workflows)"
          />
        </div>
      )}
    </div>
  );
}