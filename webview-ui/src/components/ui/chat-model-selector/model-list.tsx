import { useState, useMemo } from 'react';
import { Search, RefreshCcw } from 'lucide-react';
import { requestModelsRefresh } from '../../../hooks/use-model-fetcher';
import type { ModelItem as ModelItemType } from './types';
import { ModelItem } from './model-item';
import type { Provider } from '../../../types/api-settings';

interface ModelListProps {
  models: ModelItemType[];
  activeProvider: Provider;
  activeModel: string;
  onSelect: (provider: Provider, model: string) => void;
  loading: boolean;
  direction?: 'up' | 'down';
}

export function ModelList({ 
  models, 
  activeProvider, 
  activeModel, 
  onSelect, 
  loading,
  direction = 'up'
}: ModelListProps) {
  const [search, setSearch] = useState('');

  const searchValue = search.trim().toLowerCase();
  const hasSearch = searchValue.length > 0;

  const filteredResults = useMemo(() => {
    if (!hasSearch) return models;
    return models.filter(item =>
      item.model.toLowerCase().includes(searchValue) ||
      item.providerLabel.toLowerCase().includes(searchValue)
    );
  }, [models, hasSearch, searchValue]);

  return (
    <div
      className={`absolute left-0 w-52 rounded-xl border z-[100] ${direction === 'down' ? 'top-full mt-1' : 'bottom-full mb-1'}`}
      style={{
        backgroundColor: 'var(--vscode-editor-background)',
        borderColor: 'var(--vscode-input-border)',
      }}
    >
      <div
        className="p-2 border-b"
        style={{ borderColor: 'var(--vscode-input-border)' }}
      >
        <div className="flex items-center gap-1">
          <div
            className="relative flex-1 rounded-xl border"
            style={{
              backgroundColor: 'var(--vscode-input-background)',
              borderColor: 'var(--vscode-input-border)',
            }}
          >
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models..."
              className="w-full bg-transparent text-xs border-0 rounded-xl py-1.5 pl-6 pr-2 placeholder-opacity-50"
              style={{
                color: 'var(--vscode-input-foreground)',
                outline: 'none',
              }}
              autoFocus
            />
            <Search
              className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--vscode-input-foreground)', opacity: 0.6 }}
            />
          </div>
          <button
            type="button"
            onClick={requestModelsRefresh}
            className="flex items-center justify-center rounded-xl border px-1.5 py-1 text-[10px] min-w-[28px] h-7"
            style={{
              backgroundColor: 'var(--vscode-input-background)',
              borderColor: 'var(--vscode-input-border)',
              color: 'var(--vscode-input-foreground)',
            }}
            title="Refresh models"
          >
            <RefreshCcw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div
        className="overflow-y-auto max-h-48 overflow-hidden rounded-b-xl"
        style={{ backgroundColor: 'transparent' }}
      >
        {loading && filteredResults.length === 0 && (
          <div className="px-2 py-1.5 text-[11px] opacity-70">
            Loading models...
          </div>
        )}

        {filteredResults.length === 0 && !loading ? (
          <div className="px-2 py-1.5 text-[11px] opacity-70">
            {hasSearch ? 'No models match your search.' : 'No providers configured.'}
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredResults.map((item, index) => {
              const isSelected = item.provider === activeProvider && item.model === activeModel;
              const isLast = index === filteredResults.length - 1;

              return (
                <ModelItem
                  key={`${item.provider}:${item.model}`}
                  item={item}
                  isSelected={isSelected}
                  onSelect={onSelect}
                  isLast={isLast}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}