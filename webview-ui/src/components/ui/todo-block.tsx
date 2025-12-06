import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react';
import type { TodoTask } from '../../types/todo';

interface TodoBlockProps {
  tasks: TodoTask[];
}

export function TodoBlock({ tasks }: TodoBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  if (tasks.length === 0) return null;

  const TODOS_PER_PAGE = 4;
  const totalPages = Math.ceil(tasks.length / TODOS_PER_PAGE);
  const startIndex = currentPage * TODOS_PER_PAGE;
  const endIndex = Math.min(startIndex + TODOS_PER_PAGE, tasks.length);
  const currentTodos = tasks.slice(startIndex, endIndex);

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
  };

  const getStatusIcon = (status: TodoTask['status'], index: number) => {
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
          <div
            className="w-4 h-4 flex-shrink-0 flex items-center justify-center rounded-full text-[10px] font-semibold"
            style={{ 
              backgroundColor: 'var(--vscode-charts-blue)',
              color: 'var(--vscode-editor-background)',
              opacity: 0.9
            }}
          >
            {index + 1}
          </div>
        );
      case 'pending':
      default:
        return (
          <div
            className="w-4 h-4 flex-shrink-0 flex items-center justify-center rounded-full text-[10px] font-semibold"
            style={{ 
              backgroundColor: 'var(--vscode-descriptionForeground)',
              color: 'var(--vscode-editor-background)',
              opacity: 0.4
            }}
          >
            {index + 1}
          </div>
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
        <div className="border-t" style={{ borderColor: 'var(--vscode-input-border)' }}>
          {/* Todo List */}
          <div className="px-3 py-3 space-y-2">
            {currentTodos.map((task, index) => (
            <div
              key={task.id}
              className="w-full flex items-center gap-2.5 py-1"
            >
              <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                {getStatusIcon(task.status, index)}
              </div>
              <span
                className={`text-sm flex-1 leading-snug ${
                  task.status === 'completed' ? 'line-through opacity-60' : ''
                }`}
                style={{ 
                  color: 'var(--vscode-input-foreground)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  wordBreak: 'break-word'
                }}
                title={task.content}
              >
                {task.content}
              </span>
            </div>
            ))}
          </div>

          {/* Pagination Controls at Bottom */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t" style={{ borderColor: 'var(--vscode-input-border)' }}>
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={currentPage === 0}
                className="transition-opacity hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ color: 'var(--vscode-descriptionForeground)' }}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-medium" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                {currentPage + 1} / {totalPages}
              </span>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={currentPage === totalPages - 1}
                className="transition-opacity hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ color: 'var(--vscode-descriptionForeground)' }}
              >
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
