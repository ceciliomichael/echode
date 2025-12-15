/**
 * FileMentionMenu Component
 * 
 * Dropdown menu for @file.ext autocomplete suggestions.
 * Shows filtered list of workspace files with icons.
 */

import { useEffect, useRef } from 'react';
import { getFileIconConfig } from '../../utils/file-icon-mapper';
import { getFileName } from '../../hooks/use-file-mention';

interface FileMentionMenuProps {
    /** List of file paths to display */
    files: string[];
    /** Currently selected index */
    selectedIndex: number;
    /** Called when a file is selected */
    onSelect: (filePath: string) => void;
    /** Called when menu should close */
    onClose: () => void;
}

export function FileMentionMenu({
    files,
    selectedIndex,
    onSelect,
    onClose,
}: FileMentionMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const selectedItemRef = useRef<HTMLButtonElement>(null);

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

    // Scroll selected item into view
    useEffect(() => {
        if (selectedItemRef.current) {
            selectedItemRef.current.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex]);

    const menuStyle: React.CSSProperties = {
        position: 'absolute',
        left: '0',
        bottom: '100%',
        marginBottom: '4px',
        zIndex: 100,
    };

    if (files.length === 0) {
        return (
            <div
                ref={menuRef}
                className="rounded-lg border shadow-lg overflow-hidden"
                style={{
                    ...menuStyle,
                    backgroundColor: 'var(--vscode-dropdown-background)',
                    borderColor: 'var(--vscode-dropdown-border)',
                    minWidth: '200px',
                }}
            >
                <div
                    className="px-3 py-2 text-xs"
                    style={{ color: 'var(--vscode-descriptionForeground)' }}
                >
                    No matching files
                </div>
            </div>
        );
    }

    return (
        <div
            ref={menuRef}
            className="rounded-lg border shadow-lg overflow-hidden"
            style={{
                ...menuStyle,
                backgroundColor: 'var(--vscode-dropdown-background)',
                borderColor: 'var(--vscode-dropdown-border)',
                minWidth: '250px',
                maxWidth: '400px',
                maxHeight: '200px',
                overflowY: 'auto',
            }}
        >
            {files.map((filePath, index) => {
                const isSelected = index === selectedIndex;
                const fileName = getFileName(filePath);
                const iconConfig = getFileIconConfig(filePath);
                const Icon = iconConfig.icon;

                return (
                    <button
                        key={filePath}
                        ref={isSelected ? selectedItemRef : null}
                        type="button"
                        onClick={() => onSelect(filePath)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors"
                        style={{
                            backgroundColor: isSelected
                                ? 'var(--vscode-list-activeSelectionBackground)'
                                : 'transparent',
                            color: isSelected
                                ? 'var(--vscode-list-activeSelectionForeground)'
                                : 'var(--vscode-foreground)',
                        }}
                    >
                        <Icon
                            size={14}
                            style={{
                                color: iconConfig.color,
                                flexShrink: 0,
                            }}
                        />
                        <span className="truncate flex-1">{fileName}</span>
                        {filePath !== fileName && (
                            <span
                                className="text-xs truncate max-w-[150px]"
                                style={{ color: 'var(--vscode-descriptionForeground)' }}
                            >
                                {filePath}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
