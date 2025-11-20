import { useState } from 'react';
import { Circle, CheckCircle2, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import type { TodoTask } from '../../types/todo';

interface TodoBlockProps {
  tasks: TodoTask[];
}

export function TodoBlock({ tasks }: TodoBlockProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (tasks.length === 0) return null;

  const getStatusIcon = (status: TodoTask['status']) => {
    switch (status) {
      case 'completed':
        return (
          <CheckCircle2
            className="w-4 h-4 flex-shrink-0"
            style={{ color: 'var(--vscode-testing-iconPassed)' }}
          />
        );
      case 'in_progress':
        return (
          <Loader2
            className="w-4 h-4 flex-shrink-0 animate-spin"
            style={{ color: 'var(--vscode-charts-blue)' }}
          />
        );
      case 'pending':
      default:
        return (
          <Circle
            className="w-4 h-4 flex-shrink-0"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
          />
        );
    }
  };

  return (
    <div
      className="w-full rounded-xl border shadow-md"
      style={{
        backgroundColor: 'var(--vscode-editor-background)',
        borderColor: 'var(--vscode-input-border)',
      }}
    >
      {/* Drawer Header - Always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 transition-opacity hover:opacity-90 rounded-t-xl"
        style={{
          backgroundColor: 'transparent',
          outline: 'none',
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-medium"
            style={{ color: 'var(--vscode-input-foreground)' }}
          >
            Todo List
          </span>
          <span
            className="text-xs font-medium"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
          >
            {tasks.filter(t => t.status === 'completed').length}/{tasks.length}
          </span>
        </div>
        <span style={{ color: 'var(--vscode-descriptionForeground)' }}>
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </span>
      </button>

      {/* Drawer Content - Collapsible */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-2 space-y-2 border-t" style={{ borderColor: 'var(--vscode-input-border)' }}>
          {tasks.map((task) => (
            <div
              key={task.id}
              className="w-full flex items-center gap-2.5 py-1"
            >
              <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                {getStatusIcon(task.status)}
              </div>
              <span
                className={`text-sm flex-1 leading-snug ${
                  task.status === 'completed' ? 'line-through opacity-60' : ''
                }`}
                style={{ color: 'var(--vscode-input-foreground)' }}
              >
                {task.content}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
