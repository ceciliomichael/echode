import { Check } from 'lucide-react';
import { memo } from 'react';
import type { ModelItem as ModelItemType } from './types';
import type { Provider } from '../../../types/api-settings';

interface ModelItemProps {
  item: ModelItemType;
  isSelected: boolean;
  onSelect: (provider: Provider, model: string) => void;
  isLast: boolean;
}

export const ModelItem = memo(function ModelItem({ 
  item, 
  isSelected, 
  onSelect, 
  isLast 
}: ModelItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.provider, item.model)}
      className={`w-full px-3 py-1.5 text-left transition-colors flex items-center justify-between ${isLast ? 'rounded-b-xl' : ''}`}
      style={{
        backgroundColor: isSelected
          ? 'var(--vscode-list-activeSelectionBackground)'
          : 'transparent',
        color: isSelected
          ? 'var(--vscode-list-activeSelectionForeground)'
          : 'var(--vscode-foreground)',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      <div className="flex-1 min-w-0 mr-2">
        <div className="text-xs leading-tight truncate">{item.model}</div>
        <div className="text-[10px] opacity-60 leading-tight mt-0.5 truncate">
          {item.providerLabel}
        </div>
      </div>
      {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
    </button>
  );
});