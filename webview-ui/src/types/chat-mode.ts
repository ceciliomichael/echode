export type ChatMode = 'agent' | 'plan' | 'ask' | 'general' | 'chat' | 'review';

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
    description: 'Echo can read and plan',
  },
  {
    value: 'ask',
    label: 'Ask',
    description: 'Echo focuses on Q&A',
  },
    {
    value: 'review',
    label: 'Review',
    description: 'Code review & Audit',
  },
  {
    value: 'general',
    label: 'General',
    description: 'Echo helps with general tasks',
  },
  {
    value: 'chat',
    label: 'Chat',
    description: 'Pure conversation, no tools',
  }
];
