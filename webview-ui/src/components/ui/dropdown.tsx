import { useEffect, useRef } from 'react';

interface DropdownProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  variant?: 'default' | 'fullwidth';
}

export function Dropdown({ isOpen, onClose, children, variant = 'default' }: DropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {return null;}

  const isFullWidth = variant === 'fullwidth';

  return (
    <div
      ref={dropdownRef}
      data-edit-outside-ignore="true"
      className={
        isFullWidth
          ? "fixed inset-x-2 top-2 z-[9999] flex flex-col rounded-xl overflow-hidden max-h-[calc(100vh-16px)]"
          : "fixed top-2 right-4 w-80 max-h-96 rounded-xl border shadow-lg overflow-hidden z-[9999]"
      }
      style={{
        backgroundColor: 'var(--vscode-sideBar-background)',
        border: '1px solid var(--vscode-widget-border, var(--vscode-dropdown-border))',
        boxShadow: isFullWidth 
          ? '0 0 0 1px var(--vscode-widget-shadow, rgba(0, 0, 0, 0.16)), 0 4px 16px var(--vscode-widget-shadow, rgba(0, 0, 0, 0.24))'
          : undefined,
      }}
    >
      {children}
    </div>
  );
}
