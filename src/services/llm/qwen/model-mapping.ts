export const QWEN_CODE_MODELS = {
  STANDARD: 'qwen3.5-plus',
  THINKING: 'qwen3.5-plus-thinking',
  API: 'coder-model',
} as const;

export interface ResolvedQwenCodeModel {
  apiModel: string;
  enableThinking: boolean;
}

/**
 * Convert user-facing Qwen model options to the API model + request flags.
 */
export function resolveQwenCodeModel(model: string): ResolvedQwenCodeModel {
  const selectedModel = model?.trim() || '';

  if (selectedModel === QWEN_CODE_MODELS.THINKING) {
    return {
      apiModel: QWEN_CODE_MODELS.API,
      enableThinking: true,
    };
  }

  if (selectedModel === QWEN_CODE_MODELS.STANDARD || selectedModel === QWEN_CODE_MODELS.API) {
    return {
      apiModel: QWEN_CODE_MODELS.API,
      enableThinking: false,
    };
  }

  return {
    apiModel: selectedModel,
    enableThinking: false,
  };
}
