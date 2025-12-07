import type { Provider } from '../types/api-settings';

export interface ProviderOption {
  value: Provider;
  label: string;
}

export interface FilteredModelResult {
  provider: Provider;
  providerLabel: string;
  model: string;
}

const PROVIDER_SEARCH_KEYS: Record<Provider, string[]> = {
  anthropic: ['anthropic', 'claude'],
  openai: ['openai', 'gpt'],
  'openai-compatible': ['openai-compatible', 'openai compatible', 'openaicompatible', 'compatible'],
  megallm: ['megallm', 'mega'],
  'vscode-lm': ['vscode', 'copilot', 'vs code lm', 'vscodelm'],
  'qwen-code': ['qwen', 'qwen code', 'qwencode'],
};

// Check if word partially matches key (either direction)
function partialMatch(word: string, key: string): boolean {
  return key.includes(word) || word.includes(key);
}

export function buildFilteredModelResults(
  searchValue: string,
  providerOptions: ProviderOption[],
  modelsByProvider: Record<Provider, string[]>
): FilteredModelResult[] {
  const normalizedQuery = searchValue.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const searchWords = normalizedQuery.split(/\s+/).filter(Boolean);

  // Build flat list of provider keys for matching
  const providerKeyList: Array<{ provider: Provider; key: string }> = [];
  providerOptions.forEach((option) => {
    const keys = PROVIDER_SEARCH_KEYS[option.value] ?? [];
    keys.forEach((key) => {
      providerKeyList.push({ provider: option.value, key: key.toLowerCase() });
    });
  });
  // Sort by key length descending so longer keys match first
  providerKeyList.sort((a, b) => b.key.length - a.key.length);

  // PHASE 1: Check if the full query exactly matches any provider key
  const matchedProviders = new Set<Provider>();
  const providerMatchedWords = new Set<string>();
  let hasExactMatch = false;

  // First, check for exact matches (highest priority)
  for (const { provider, key } of providerKeyList) {
    if (key === normalizedQuery) {
      matchedProviders.add(provider);
      searchWords.forEach((w) => providerMatchedWords.add(w));
      hasExactMatch = true;
    }
  }

  // If no exact match, check if query is typing towards a longer key (query is prefix of key)
  // or if a key is fully contained in the query
  if (!hasExactMatch) {
    for (const { provider, key } of providerKeyList) {
      // Key starts with query (user is typing toward this provider)
      // OR query starts with key (query contains provider name plus more)
      if (key.startsWith(normalizedQuery) || normalizedQuery.startsWith(key)) {
        matchedProviders.add(provider);
        searchWords.forEach((w) => providerMatchedWords.add(w));
      }
    }
  }

  // PHASE 2: If no full-query match, do word-by-word partial matching
  if (matchedProviders.size === 0) {
    for (const word of searchWords) {
      let matched = false;
      for (const { provider, key } of providerKeyList) {
        // Only match if word is substantial (3+ chars) or is exact match
        if (word.length >= 3 && partialMatch(word, key)) {
          matchedProviders.add(provider);
          providerMatchedWords.add(word);
          matched = true;
          // Don't break - let this word match multiple providers if applicable
        } else if (word === key) {
          matchedProviders.add(provider);
          providerMatchedWords.add(word);
          matched = true;
        }
      }
      // Short words (< 3 chars) that don't exact-match are treated as model words
      if (!matched && word.length < 3) {
        // Will be picked up as model word below
      }
    }
  }

  // Words that didn't match any provider are used for model filtering
  const modelWords = searchWords.filter((word) => !providerMatchedWords.has(word));

  // If no providers matched, search all providers using all words for model matching
  const providersToSearch: Provider[] =
    matchedProviders.size > 0
      ? Array.from(matchedProviders)
      : providerOptions.map((p) => p.value);

  // If no providers matched, all words are model words
  const finalModelWords = matchedProviders.size > 0 ? modelWords : searchWords;

  const results: FilteredModelResult[] = [];

  for (const provider of providersToSearch) {
    const providerModels = modelsByProvider[provider] || [];
    if (providerModels.length === 0) continue;

    const providerLabel = providerOptions.find((p) => p.value === provider)?.label ?? provider;

    providerModels.forEach((model) => {
      const modelLower = model.toLowerCase();

      // Model must contain all model words (partial matching)
      if (finalModelWords.length > 0) {
        const matchesAllWords = finalModelWords.every((word) => modelLower.includes(word));
        if (!matchesAllWords) {
          return;
        }
      }

      results.push({ provider, providerLabel, model });
    });
  }

  return results;
}
