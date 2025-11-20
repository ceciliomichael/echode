/**
 * Todo task types
 */

export type TodoStatus = 'pending' | 'in_progress' | 'completed';

export interface TodoTask {
  id: string;
  content: string;
  status: TodoStatus;
}

export interface TodoState {
  tasks: TodoTask[];
  lastUpdated: number;
}
