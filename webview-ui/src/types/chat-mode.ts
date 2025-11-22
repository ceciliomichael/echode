export type ChatMode = 'agent' | 'plan';

export const DEFAULT_CHAT_MODE: ChatMode = 'agent';

export interface ChatModeOption {
  value: ChatMode;
  label: string;
  description: string;
}

export const CHAT_MODE_OPTIONS: ChatModeOption[] = [
  {
    value: 'agent',
    label: 'Agent',
    description: 'Echo can write and edit code',
  },
  {
    value: 'plan',
    label: 'Plan',
    description: 'Echo reads but won\'t edit',
  },
];
