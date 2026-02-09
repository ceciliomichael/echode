export type ToolFormatKind = 'xml' | 'kimi';

export function isKimiModel(model: string | undefined | null): boolean {
  if (!model) {
    return false;
  }
  return model.toLowerCase().includes('kimi');
}

export function getToolFormatKind(model: string | undefined | null): ToolFormatKind {
  return isKimiModel(model) ? 'kimi' : 'xml';
}
