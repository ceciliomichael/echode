import * as vscode from 'vscode';
import { getSettingsService, ApiSettings } from './settings-service';
import { LLMFactory } from './llm/llm-factory';
import { ChatStreamSettings, ChatMessage } from './llm/llm-provider.interface';

const COMMIT_MESSAGE_SYSTEM_PROMPT = `Generate a concise Git commit message from the diff.

## FORMAT
type(scope): brief description

Optional: 1-2 sentence body if needed for context.

## RULES
- Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore
- Scope: module/component name (e.g., auth, api, chat)
- Subject: max 50 chars, imperative mood, no period, no emoji
- Body: only if the subject alone isn't clear enough
- Keep it simple and scannable

## EXAMPLES
feat(auth): add token refresh with retry logic

fix(chat): resolve race condition in message queue

refactor(api): simplify error handling across endpoints

Consolidated error responses and removed redundant try-catch blocks.

## OUTPUT
Generate ONLY the commit message. No markdown, no explanations.`;

/**
 * Interface for commit message settings stored in API settings
 */
interface CommitMessageSettings {
  provider: string;
  model: string;
  customPrompt: string;
}

/**
 * Default base URLs for providers (used when custom URL is not set)
 */
const PROVIDER_DEFAULT_URLS: Record<string, string> = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com',
  'openai-compatible': 'http://localhost:1234',
  megallm: 'https://ai.megallm.io',
  'vscode-lm': '',
  'qwen-code': 'https://dashscope.aliyuncs.com/compatible-mode/v1',
};

/**
 * Helper to get the chat stream settings for commit message generation.
 * Uses dedicated commitMessageSettings if configured, otherwise falls back to chat model.
 */
function getChatStreamSettings(apiSettings: ApiSettings): ChatStreamSettings & { customPrompt?: string } {
  const commitSettings = apiSettings.commitMessageSettings as CommitMessageSettings | undefined;

  // Use commit message settings if configured with a model
  const provider = (commitSettings?.provider && commitSettings?.model)
    ? commitSettings.provider as ChatStreamSettings['provider']
    : apiSettings.provider as ChatStreamSettings['provider'];

  const commitModel = (commitSettings?.provider && commitSettings?.model) ? commitSettings.model : '';

  let apiKey = '';
  let model = '';
  let maxTokens = 4096;
  let baseURL = '';
  let temperature = 0.3;

  switch (provider) {
    case 'anthropic':
      apiKey = apiSettings.anthropicApiKey ?? '';
      model = commitModel || (apiSettings.anthropicModel ?? '');
      maxTokens = apiSettings.anthropicMaxTokens;
      baseURL = apiSettings.anthropicCustomUrl || PROVIDER_DEFAULT_URLS.anthropic;
      temperature = apiSettings.anthropicTemperature;
      break;
    case 'openai':
      apiKey = apiSettings.openaiApiKey ?? '';
      model = commitModel || (apiSettings.openaiModel ?? '');
      maxTokens = apiSettings.openaiMaxTokens;
      baseURL = apiSettings.openaiCustomUrl || PROVIDER_DEFAULT_URLS.openai;
      temperature = apiSettings.openaiTemperature;
      break;
    case 'openai-compatible':
      apiKey = apiSettings.openaiCompatibleApiKey ?? '';
      model = commitModel || (apiSettings.openaiCompatibleModel ?? '');
      maxTokens = apiSettings.openaiCompatibleMaxTokens;
      baseURL = apiSettings.openaiCompatibleCustomUrl || PROVIDER_DEFAULT_URLS['openai-compatible'];
      temperature = apiSettings.openaiCompatibleTemperature;
      break;
    case 'megallm':
      apiKey = apiSettings.megallmApiKey ?? '';
      model = commitModel || (apiSettings.megallmModel ?? '');
      maxTokens = apiSettings.megallmMaxTokens;
      baseURL = apiSettings.megallmCustomUrl || PROVIDER_DEFAULT_URLS.megallm;
      temperature = apiSettings.megallmTemperature;
      break;
    case 'qwen-code':
      apiKey = '';
      model = commitModel || (apiSettings.qwenCodeModel ?? '');
      maxTokens = apiSettings.qwenCodeMaxTokens;
      baseURL = PROVIDER_DEFAULT_URLS['qwen-code'];
      temperature = apiSettings.qwenCodeTemperature;
      break;
    case 'vscode-lm':
      apiKey = '';
      model = commitModel || (apiSettings.vscodeLmModel ?? '');
      maxTokens = apiSettings.vscodeLmMaxTokens;
      baseURL = '';
      temperature = apiSettings.vscodeLmTemperature;
      break;
  }

  return {
    provider,
    apiKey,
    model,
    maxTokens,
    baseURL,
    temperature,
    qwenCodeOauthPath: apiSettings.qwenCodeOauthPath,
    customPrompt: commitSettings?.customPrompt,
  };
}

/**
 * Get diff from Git (staged first, then unstaged as fallback)
 */
async function getGitDiff(): Promise<string | null> {
  const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
  if (!gitExtension) {
    vscode.window.showErrorMessage('Git extension not found');
    return null;
  }

  const git = gitExtension.exports.getAPI(1);
  if (!git.repositories.length) {
    vscode.window.showErrorMessage('No Git repository found');
    return null;
  }

  const repository = git.repositories[0];

  try {
    // Try staged changes first
    const stagedDiff = await repository.diff(true);

    if (stagedDiff && stagedDiff.trim() !== '') {
      return stagedDiff;
    }

    // Fall back to unstaged changes
    const unstagedDiff = await repository.diff(false);

    if (unstagedDiff && unstagedDiff.trim() !== '') {
      return unstagedDiff;
    }

    vscode.window.showWarningMessage('No changes found. Make some changes first.');
    return null;
  } catch (error) {
    console.error('[GitCommitGenerator] Error getting diff:', error);
    vscode.window.showErrorMessage('Failed to get changes');
    return null;
  }
}

/**
 * Simple non-streaming completion for commit messages
 */
async function generateCommitMessage(diff: string): Promise<string | null> {
  const apiSettings = getSettingsService().getSettings();
  const settings = getChatStreamSettings(apiSettings);

  if (!settings.apiKey && settings.provider !== 'vscode-lm' && settings.provider !== 'qwen-code') {
    vscode.window.showErrorMessage('Please configure API settings in Echode settings first.');
    return null;
  }

  // Build system prompt with optional custom instructions
  let systemPrompt = COMMIT_MESSAGE_SYSTEM_PROMPT;
  if (settings.customPrompt && settings.customPrompt.trim()) {
    systemPrompt += `\n\nAdditional custom instructions:\n${settings.customPrompt.trim()}`;
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Generate a commit message for these staged changes:\n\n${diff}` }
  ];

  try {
    // Concise commit messages need fewer tokens
    const commitSettings = { ...settings, maxTokens: 256 };

    // Use a temporary webview-like object to collect the response
    let response = '';
    const collector = {
      webview: {
        postMessage: (msg: { type: string; chunk?: string }) => {
          if (msg.type === 'chatStreamChunk' && msg.chunk) {
            response += msg.chunk;
          }
        }
      }
    } as vscode.WebviewView;

    const provider = LLMFactory.getProvider(commitSettings.provider);
    const abortController = new AbortController();

    await provider.streamChat(
      Date.now(),
      messages,
      commitSettings,
      collector,
      abortController.signal
    );

    return response.trim();
  } catch (error) {
    console.error('[GitCommitGenerator] Error generating commit message:', error);
    vscode.window.showErrorMessage(`Failed to generate commit message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

/**
 * Command handler for generating commit messages
 */
export async function generateGitCommitMessage(): Promise<void> {
  const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
  if (!gitExtension) {
    vscode.window.showErrorMessage('Git extension not found');
    return;
  }

  const git = gitExtension.exports.getAPI(1);
  if (!git.repositories.length) {
    vscode.window.showErrorMessage('No Git repository found');
    return;
  }

  const repository = git.repositories[0];

  // Show progress
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.SourceControl,
      title: 'Generating commit message...',
      cancellable: false
    },
    async () => {
      const diff = await getGitDiff();
      if (!diff) {
        return;
      }

      const commitMessage = await generateCommitMessage(diff);
      if (commitMessage) {
        // Set the commit message in the SCM input box
        repository.inputBox.value = commitMessage;
      }
    }
  );
}

// Git extension types
interface GitExtension {
  getAPI(version: 1): GitAPI;
}

interface GitAPI {
  repositories: Repository[];
}

interface Repository {
  inputBox: { value: string };
  diff(staged: boolean): Promise<string>;
}
