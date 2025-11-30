import { useEffect, useRef } from 'react';
import { AlertTriangle, Folder, FolderPlus, FilePlus, ChevronRight } from 'lucide-react';
import { getFileIconConfig } from '../../utils/file-icon-mapper';
import {
  ContextMenuOptionType,
  type ContextMenuItem,
  isOptionSelectable,
} from '../../utils/context-mentions';

interface ContextMenuProps {
  options: ContextMenuItem[];
  selectedIndex: number;
  onSelect: (type: ContextMenuOptionType, value?: string) => void;
  onClose: () => void;
  onMouseDown: () => void;
  setSelectedIndex: (index: number) => void;
}

export function ContextMenu({
  options,
  selectedIndex,
  onSelect,
  onClose,
  onMouseDown,
  setSelectedIndex,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (menuRef.current) {
      const selectedElement = menuRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        const menuRect = menuRef.current.getBoundingClientRect();
        const selectedRect = selectedElement.getBoundingClientRect();

        if (selectedRect.bottom > menuRect.bottom) {
          menuRef.current.scrollTop += selectedRect.bottom - menuRect.bottom;
        } else if (selectedRect.top < menuRect.top) {
          menuRef.current.scrollTop -= menuRect.top - selectedRect.top;
        }
      }
    }
  }, [selectedIndex]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (options.length === 0) {
    return null;
  }

  const getIconForOption = (option: ContextMenuItem) => {
    switch (option.type) {
      case ContextMenuOptionType.Problems:
        return <AlertTriangle className="w-4 h-4 flex-shrink-0" />;
      case ContextMenuOptionType.Folder:
        if (option.value) {
          // Specific folder - show folder icon
          return <Folder className="w-4 h-4 flex-shrink-0" style={{ color: '#dcb67a' }} />;
        }
        // Add Folder option
        return <FolderPlus className="w-4 h-4 flex-shrink-0" />;
      case ContextMenuOptionType.File:
        if (option.value) {
          // Specific file - show file type icon
          const iconConfig = getFileIconConfig(option.value);
          if (iconConfig) {
            const Icon = iconConfig.icon;
            return <Icon className="w-4 h-4 flex-shrink-0" style={{ color: iconConfig.color }} />;
          }
        }
        // Add File option
        return <FilePlus className="w-4 h-4 flex-shrink-0" />;
      default:
        return null;
    }
  };

  const renderOptionContent = (option: ContextMenuItem) => {
    switch (option.type) {
      case ContextMenuOptionType.Problems:
        return <span>Problems</span>;

      case ContextMenuOptionType.File:
      case ContextMenuOptionType.Folder:
        if (option.value) {
          // File/folder with path - show basename and folder path
          return (
            <div className="flex-1 overflow-hidden flex gap-2 items-center justify-between whitespace-nowrap text-left">
              <span className="truncate">{option.label}</span>
              {option.description && (
                <span
                  className="truncate text-[11px] opacity-60"
                  style={{ direction: 'rtl', textAlign: 'right', flex: 1 }}
                >
                  {option.description}
                </span>
              )}
            </div>
          );
        }
        // Top-level Add File/Add Folder
        return <span>{option.label}</span>;

      case ContextMenuOptionType.NoResults:
        return <span className="opacity-60">{option.label || 'No results'}</span>;

      default:
        return null;
    }
  };

  // Check if option should show chevron (drillable)
  const shouldShowChevron = (option: ContextMenuItem) => {
    return (
      (option.type === ContextMenuOptionType.File || option.type === ContextMenuOptionType.Folder) &&
      !option.value
    );
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 4px)',
        left: 0,
        zIndex: 50,
      }}
      onMouseDown={onMouseDown}
    >
      <div
        ref={menuRef}
        style={{
          backgroundColor: 'var(--vscode-dropdown-background)',
          border: '1px solid var(--vscode-editorGroup-border)',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '280px',
          minWidth: '200px',
          maxWidth: '320px',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {options.map((option, index) => {
          const isSelectable = isOptionSelectable(option);
          const isSelected = index === selectedIndex && isSelectable;

          return (
            <div
              key={`${option.type}-${option.value || index}`}
              onClick={() => isSelectable && onSelect(option.type, option.value)}
              onMouseEnter={() => isSelectable && setSelectedIndex(index)}
              style={{
                padding: '6px 10px',
                cursor: isSelectable ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                position: 'relative',
                // Blue highlight for selected item (matching Roo Code)
                backgroundColor: isSelected
                  ? 'var(--vscode-list-activeSelectionBackground, #094771)'
                  : 'transparent',
                color: isSelected
                  ? 'var(--vscode-list-activeSelectionForeground, #ffffff)'
                  : 'var(--vscode-dropdown-foreground)',
              }}
            >
              {getIconForOption(option)}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  fontSize: '13px',
                }}
              >
                {renderOptionContent(option)}
              </div>
              {shouldShowChevron(option) && (
                <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-50" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
