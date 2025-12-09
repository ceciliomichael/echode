import * as vscode from 'vscode';
import { getSettingsService, ApiSettings } from './settings-service';
import { LLMFactory } from './llm/llm-factory';
import { ChatStreamSettings, ChatMessage } from './llm/llm-provider.interface';

const COMMIT_MESSAGE_SYSTEM_PROMPT = `You are an expert Git commit message generator. Analyze the code diff thoroughly and generate a detailed, well-structured commit message.

## OUTPUT FORMAT

<subject line>

<blank line>

<bullet points describing specific changes>

## SUBJECT LINE RULES

1. Format: type(scope): concise summary of the overall change
2. Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore
3. Scope: Use the actual module/component/file area from the code (e.g., auth, api, sidebar, chat, tools)
4. Max 72 characters
5. Imperative mood ("add" not "added", "fix" not "fixed")
6. No period at end
7. NO emojis
8. Summarize the PRIMARY purpose of all changes

## BULLET POINT RULES

1. Start each bullet with "- "
2. Each bullet describes ONE specific change
3. Reference file names with backticks: \`filename.ts\`
4. Be specific about WHAT was changed and WHY
5. Use action verbs: Updated, Added, Removed, Refactored, Fixed, Enhanced, Improved, Streamlined, Revised
6. Group related changes logically
7. Include the impact or purpose of each change
8. Order bullets by importance or logical flow

## ANALYSIS APPROACH

1. Identify ALL files changed in the diff
2. For each file, determine:
   - What specific functions/components/sections were modified
   - The purpose of each modification
   - How it relates to the overall change
3. Group related changes across files
4. Determine the primary theme/purpose of all changes combined

## EXAMPLES

GOOD:
\`\`\`
Refactor authentication flow and improve error handling

- Updated \`auth-service.ts\` to implement token refresh with exponential backoff retry logic.
- Added \`token-validator.ts\` with JWT validation and expiration checking utilities.
- Enhanced \`login-handler.ts\` to display user-friendly error messages on auth failures.
- Removed deprecated \`legacy-auth.ts\` module and migrated all references to new auth service.
- Updated \`api-client.ts\` to automatically attach auth headers and handle 401 responses.
\`\`\`

GOOD:
\`\`\`
Add user profile image upload with compression

- Added \`image-upload.tsx\` component with drag-and-drop support and file type validation.
- Implemented \`image-compressor.ts\` utility to resize images to max 500KB before upload.
- Updated \`user-profile.tsx\` to integrate new upload component and display preview.
- Added \`upload-service.ts\` with S3 presigned URL generation and multipart upload support.
- Enhanced \`user-api.ts\` to handle profile image URL updates and cache invalidation.
\`\`\`

GOOD:
\`\`\`
Fix race condition in WebSocket reconnection logic

- Fixed \`websocket-client.ts\` to properly cancel pending reconnection attempts on manual disconnect.
- Added mutex lock in \`connection-manager.ts\` to prevent concurrent connection state modifications.
- Updated \`message-queue.ts\` to buffer messages during reconnection and replay on successful connect.
\`\`\`

BAD (too vague):
\`\`\`
Update authentication files
- Updated auth-service.ts
- Updated login-handler.ts
\`\`\`

BAD (no detail):
\`\`\`
Fix bug

- Fixed the issue
\`\`\`

## OUTPUT

Generate ONLY the commit message (subject + blank line + bullets). No explanations, no markdown code blocks, no additional commentary.`;

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
    // For detailed commit messages with bullet points, we need more tokens
    const commitSettings = { ...settings, maxTokens: 1024 };
    
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
