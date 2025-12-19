import { useEffect } from 'react';
import { useModelFetcher } from '../../hooks/use-model-fetcher';
import type { Provider } from '../../types/api-settings';

interface CustomModelFetcherProps {
  provider: Provider;
  baseUrl: string;
  apiKey: string;
  onModelsFetched: (provider: Provider, models: string[], loading: boolean) => void;
}

export function CustomModelFetcher({
  provider,
  baseUrl,
  apiKey,
  onModelsFetched
}: CustomModelFetcherProps) {
  const { models, loadingModels } = useModelFetcher(provider, baseUrl, apiKey);

  useEffect(() => {
    onModelsFetched(provider, models, loadingModels);
  }, [provider, models, loadingModels, onModelsFetched]);

  return null;
}