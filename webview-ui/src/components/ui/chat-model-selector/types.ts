import type { Provider } from '../../../types/api-settings';

export interface ModelItem {
  provider: Provider;
  providerLabel: string;
  model: string;
}

export interface ChatModelSelectorProps {
  provider: Provider;
  model: string;
  onChange: (provider: Provider, model: string) => void;
  disabled?: boolean;
  direction?: 'up' | 'down';
}