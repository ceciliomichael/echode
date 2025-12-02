import { useEffect } from 'react';
import type { Message } from '../types/chat';
import type { TodoTask } from '../types/todo';

interface TodoExtractionConfig {
  messages: Message[];
  updateTodos: (tasks: TodoTask[]) => void;
}

export function useTodoExtraction(config: TodoExtractionConfig): void {
  const { messages, updateTodos } = config;

  useEffect(() => {
    let mostRecentTodoWrite: { tasks: TodoTask[]; timestamp: number } | null = null;
    
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.toolExecutions) {
        for (const execution of msg.toolExecutions.values()) {
          if (execution.toolName === 'todo_write') {
            const execTimestamp = execution.completedAt ?? execution.startedAt ?? 
              (msg.timestamp instanceof Date ? msg.timestamp.getTime() : new Date(msg.timestamp).getTime());
            
            let tasks: TodoTask[] | null = null;

            if (execution.status === 'completed' && 
                execution.result?.success &&
                execution.result.data) {
              const data = execution.result.data as { tasks?: unknown[] };
              if (data.tasks && Array.isArray(data.tasks)) {
                tasks = data.tasks as TodoTask[];
              }
            } 
            else if ((execution.status === 'pending' || execution.status === 'executing') && 
                     execution.parameters?.tasks) {
              const paramTasks = execution.parameters.tasks;
              if (Array.isArray(paramTasks)) {
                tasks = paramTasks as TodoTask[];
              }
            }

            if (tasks && (!mostRecentTodoWrite || execTimestamp > mostRecentTodoWrite.timestamp)) {
              mostRecentTodoWrite = {
                tasks,
                timestamp: execTimestamp
              };
            }
          }
        }
      }
    }
    
    if (mostRecentTodoWrite) {
      updateTodos(mostRecentTodoWrite.tasks);
    } else if (messages.length === 0) {
      updateTodos([]);
    }
  }, [messages, updateTodos]);
}
