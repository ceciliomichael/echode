import { useState, useCallback } from 'react';
import type { TodoTask, TodoState } from '../types/todo';

/**
 * Hook for managing todo state
 * Tracks todos extracted from tool execution results
 */
export function useTodo() {
  const [todoState, setTodoState] = useState<TodoState>({
    tasks: [],
    lastUpdated: Date.now(),
  });

  /**
   * Update todos from tool execution result
   */
  const updateTodos = useCallback((tasks: TodoTask[]) => {
    setTodoState({
      tasks,
      lastUpdated: Date.now(),
    });
  }, []);

  /**
   * Clear all todos
   */
  const clearTodos = useCallback(() => {
    setTodoState({
      tasks: [],
      lastUpdated: Date.now(),
    });
  }, []);

  /**
   * Toggle task status (for UI interaction)
   */
  const toggleTaskStatus = useCallback((taskId: string) => {
    setTodoState(prev => ({
      tasks: prev.tasks.map(task =>
        task.id === taskId
          ? {
              ...task,
              status: task.status === 'completed' ? 'pending' : 'completed',
            }
          : task
      ),
      lastUpdated: Date.now(),
    }));
  }, []);

  return {
    tasks: todoState.tasks,
    updateTodos,
    clearTodos,
    toggleTaskStatus,
    hasTodos: todoState.tasks.length > 0,
  };
}
