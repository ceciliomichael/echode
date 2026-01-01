/**
 * Workflow types for the Workflows settings tab
 */

export type WorkflowSource = 'workspace' | 'global';

export interface Workflow {
  name: string;
  content: string;
  source: WorkflowSource;
}

export interface WorkflowsListMessage {
  type: 'workflowsList';
  workflows: Workflow[];
  error?: string;
}

export interface WorkflowSavedMessage {
  type: 'workflowSaved';
  success: boolean;
  name?: string;
  source?: WorkflowSource;
  error?: string;
}

export interface WorkflowDeletedMessage {
  type: 'workflowDeleted';
  success: boolean;
  name?: string;
  source?: WorkflowSource;
  error?: string;
}

export interface SaveWorkflowRequest {
  name: string;
  content: string;
  source: WorkflowSource;
}

export interface DeleteWorkflowRequest {
  name: string;
  source: WorkflowSource;
}