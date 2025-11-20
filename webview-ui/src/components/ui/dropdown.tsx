import { useEffect, useRef } from 'react';

interface DropdownProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function Dropdown({ isOpen, onClose, children }: DropdownProps) {
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

  return (
    <div
      ref={dropdownRef}
      data-edit-outside-ignore="true"
      className="fixed top-2 right-4 w-80 max-h-96 rounded-lg border shadow-lg overflow-hidden z-50"
      style={{
        backgroundColor: 'var(--vscode-dropdown-background)',
        borderColor: 'var(--vscode-dropdown-border)',
      }}
    >
      {children}
    </div>
  );
}
