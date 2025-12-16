import React, { useEffect, useMemo, useRef } from 'react';
import { File, Folder, Info } from 'lucide-react';

import {
    ContextMenuOptionType,
    getContextMenuOptions,
    type ContextMenuQueryItem,
    type SearchResult,
} from '../../utils/context-mentions';
import { getFileIconConfig } from '../../utils/file-icon-mapper';

interface ContextMenuProps {
    onSelect: (type: ContextMenuOptionType, value?: string) => void;
    searchQuery: string;
    onMouseDown: (e: React.MouseEvent) => void;
    selectedIndex: number;
    setSelectedIndex: (index: number) => void;
    selectedType: ContextMenuOptionType | null;
    dynamicSearchResults?: SearchResult[];
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
    onSelect,
    searchQuery,
    onMouseDown,
    selectedIndex,
    setSelectedIndex,
    selectedType,
    dynamicSearchResults = [],
}) => {
    const menuRef = useRef<HTMLDivElement>(null);

    const filteredOptions = useMemo(() => {
        return getContextMenuOptions(searchQuery, selectedType, dynamicSearchResults);
    }, [searchQuery, selectedType, dynamicSearchResults]);

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

    const getIconForOption = (type: ContextMenuOptionType, filePath?: string) => {
        switch (type) {
            case ContextMenuOptionType.File: {
                // If this is a category header (no filePath), show generic file icon
                if (!filePath) {
                    return <File className="w-4 h-4 mr-2 flex-shrink-0 text-blue-400" />;
                }
                const config = getFileIconConfig(filePath);
                const IconComponent = config.icon;
                return <IconComponent className="w-4 h-4 mr-2 flex-shrink-0" style={{ color: config.color }} />;
            }
            case ContextMenuOptionType.Folder:
                return <Folder className="w-4 h-4 mr-2 flex-shrink-0 text-yellow-400" />;
            default:
                return <Info className="w-4 h-4 mr-2 flex-shrink-0" />;
        }
    };

    const isOptionSelectable = (option: ContextMenuQueryItem): boolean => {
        return (
            option.type !== ContextMenuOptionType.NoResults &&
            option.type !== ContextMenuOptionType.SectionHeader
        );
    };

    return (
        <div
            className="w-full z-50 overflow-hidden"
            onMouseDown={onMouseDown}
        >
            <div
                ref={menuRef}
                className="bg-[var(--vscode-dropdown-background)] border border-[var(--vscode-editorGroup-border)] rounded-xl shadow-lg flex flex-col max-h-[200px] overflow-y-auto overflow-x-hidden"
            >
                {filteredOptions.length > 0 ? (
                    filteredOptions.map((option, index) => (
                        <div
                            key={`${option.type}-${option.value || index}`}
                            onClick={() => isOptionSelectable(option) && onSelect(option.type, option.value)}
                            className={`
                                flex items-center px-2 py-1.5 cursor-pointer text-sm
                                ${index === selectedIndex ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]' : 'text-[var(--vscode-dropdown-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]'}
                                ${!isOptionSelectable(option) ? 'cursor-default opacity-70' : ''}
                            `}
                            onMouseEnter={() => {
                                if (isOptionSelectable(option)) {
                                    setSelectedIndex(index);
                                }
                            }}
                        >
                            {getIconForOption(option.type, option.value)}
                            <div className="flex flex-col min-w-0 flex-1">
                                <span className="truncate leading-tight">{option.label || option.value || option.type}</span>
                                {option.description && (
                                    <span className="text-xs opacity-70 truncate leading-tight">{option.description}</span>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="p-2 text-center opacity-70 text-sm">
                        No results
                    </div>
                )}
            </div>
        </div>
    );
};
