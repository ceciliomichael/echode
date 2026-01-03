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
 * Sanitize commit message by removing markdown code blocks and extra formatting
 */
function sanitizeCommitMessage(message: string): string {
  let cleaned = message.trim();
  
  // Remove markdown code blocks (```...``` or ```language\n...\n```)
  cleaned = cleaned.replace(/^```[\w]*\n?/gm, '').replace(/\n?```$/gm, '');
  
  // Remove inline code backticks if wrapping entire message
  if (cleaned.startsWith('`') && cleaned.endsWith('`') && !cleaned.slice(1, -1).includes('`')) {
    cleaned = cleaned.slice(1, -1);
  }
  
  // Remove leading/trailing quotes if present
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
      (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }
  
  return cleaned.trim();
}

/**
 *  Interface for commit message settings stored in API settings
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
 * Providers that can operate without an API key (local LLMs, built-in auth, etc.)
 */
const PROVIDERS_ALLOWING_EMPTY_KEY = ['vscode-lm', 'qwen-code', 'openai-compatible'];

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

  if (provider.startsWith('custom-')) {
    // Custom providers have IDs prefixed with 'custom-' in the UI, but stored without it in customProviders list
    // logic in SettingsModelSelector: const providerId = `custom-${cp.id}`;
    const customConfig = apiSettings.customProviders?.find(p => `custom-${p.id}` === provider);
    if (customConfig) {
      apiKey = customConfig.apiKey || '';
      model = commitModel || customConfig.model;
      maxTokens = customConfig.maxTokens;
      baseURL = customConfig.baseUrl;
      temperature = customConfig.temperature;
    }
  }

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

interface GitDiffResult {
  diff: string;
  isStaged: boolean;
  isInitialCommit: boolean;
}

/**
 * Check if this is the first commit (no HEAD exists)
 */
async function isInitialCommit(repository: Repository): Promise<boolean> {
  // Check state first (cheaper and more reliable for empty repos)
  if (!repository.state.HEAD || !repository.state.HEAD.commit) {
    return true;
  }

  try {
    await repository.getCommit('HEAD');
    return false;
  } catch {
    // HEAD doesn't exist, this is the initial commit
    return true;
  }
}

/**
 * Get file contents for initial commit (when there's no HEAD to diff against)
 */
async function getInitialCommitContent(repository: Repository): Promise<string | null> {
  const indexChanges = repository.state.indexChanges;
  const workingTreeChanges = repository.state.workingTreeChanges;
  
  // Prefer staged changes, fall back to working tree changes
  const changes = indexChanges.length > 0 ? indexChanges : workingTreeChanges;
  
  if (changes.length === 0) {
    return null;
  }

  const MAX_FILES = 20;
  const MAX_FILE_SIZE = 10 * 1024; // 10KB

  const fileContents: string[] = [];
  const filesToProcess = changes.slice(0, MAX_FILES);
  
  for (const change of filesToProcess) {
    try {
      const relativePath = vscode.workspace.asRelativePath(change.uri);
      
      // Read file content with size check
      const stat = await vscode.workspace.fs.stat(change.uri);
      if (stat.size > MAX_FILE_SIZE) {
        fileContents.push(`--- /dev/null\n+++ ${relativePath}\n@@ -0,0 +1,1 @@\n+ (File too large: ${stat.size} bytes. Skipped for summary.)`);
        continue;
      }

      const content = await vscode.workspace.fs.readFile(change.uri);
      const textContent = new TextDecoder().decode(content);
      
      // Format as a pseudo-diff for the LLM
      fileContents.push(`--- /dev/null\n+++ ${relativePath}\n@@ -0,0 +1,${textContent.split('\n').length} @@\n${textContent.split('\n').map(line => `+${line}`).join('\n')}`);
    } catch (err) {
      console.error(`[GitCommitGenerator] Error reading file ${change.uri.fsPath}:`, err);
    }
  }

  if (changes.length > MAX_FILES) {
    fileContents.push(`\n... and ${changes.length - MAX_FILES} more files.`);
  }

  return fileContents.length > 0 ? fileContents.join('\n\n') : null;
}

/**
 * Get diff from Git (staged first, then unstaged as fallback)
 * Also handles initial commit when there's no HEAD
 */
async function getGitDiff(repository: Repository): Promise<GitDiffResult | null> {
  try {
    // Check if this is the initial commit (no HEAD)
    const initialCommit = await isInitialCommit(repository);
    
    if (initialCommit) {
      // For initial commit, read file contents directly
      const content = await getInitialCommitContent(repository);
      if (content) {
        const hasStaged = repository.state.indexChanges.length > 0;
        return { diff: content, isStaged: hasStaged, isInitialCommit: true };
      }
      vscode.window.showWarningMessage('No files found. Add some files first.');
      return null;
    }

    // Try staged changes first
    try {
      const stagedDiff = await repository.diff(true);

      if (stagedDiff && stagedDiff.trim() !== '') {
        return { diff: stagedDiff, isStaged: true, isInitialCommit: false };
      }
    } catch (error) {
      // If diff fails, it might be because there is no HEAD yet (initial commit)
      // Fall back to reading file contents directly
      const content = await getInitialCommitContent(repository);
      if (content) {
        const hasStaged = repository.state.indexChanges.length > 0;
        return { diff: content, isStaged: hasStaged, isInitialCommit: true };
      }
    }

    // Fall back to unstaged changes
    const unstagedDiff = await repository.diff(false);

    if (unstagedDiff && unstagedDiff.trim() !== '') {
      return { diff: unstagedDiff, isStaged: false, isInitialCommit: false };
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
async function generateCommitMessage(diffResult: GitDiffResult): Promise<string | null> {
  const apiSettings = getSettingsService().getSettings();
  const settings = getChatStreamSettings(apiSettings);

  if (!settings.apiKey && !PROVIDERS_ALLOWING_EMPTY_KEY.includes(settings.provider) && !settings.provider.startsWith('custom-')) {
    vscode.window.showErrorMessage('Please configure API settings in EchoDE settings first.');
    return null;
  }

  // Build system prompt with optional custom instructions
  let systemPrompt = COMMIT_MESSAGE_SYSTEM_PROMPT;

  // Add specific context for initial commits
  if (diffResult.isInitialCommit) {
    systemPrompt += `\n\n## SPECIAL INSTRUCTION\nThis is the INITIAL COMMIT. The message should reflect that this is the project setup. Use a title like "feat: initial project setup" or "chore: initial commit". Summarize the core project structure briefly in the body if needed.`;
  }

  if (settings.customPrompt && settings.customPrompt.trim()) {
    systemPrompt += `\n\nAdditional custom instructions:\n${settings.customPrompt.trim()}`;
  }

  const changeType = diffResult.isStaged ? 'staged' : 'unstaged';
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Generate a commit message for these ${changeType} changes:\n\n${diffResult.diff}` }
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

    return sanitizeCommitMessage(response);
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

  // Find the active repository (handles multi-repo workspaces)
  const repository = await findActiveRepository(git);
  if (!repository) {
    // User cancelled the picker or no valid repository found
    return;
  }

  // Show progress
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.SourceControl,
      title: 'Generating commit message...',
      cancellable: false
    },
    async () => {
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Commit message generation timed out')), 20000); // 20s timeout
      });

      const generationTask = async () => {
        const diff = await getGitDiff(repository);
        if (!diff) {
          return;
        }

        const commitMessage = await generateCommitMessage(diff);
        if (commitMessage) {
          // Set the commit message in the SCM input box
          repository.inputBox.value = commitMessage;
        }
      };

      try {
        await Promise.race([generationTask(), timeoutPromise]);
      } catch (error) {
        if (error instanceof Error && error.message === 'Commit message generation timed out') {
          vscode.window.showErrorMessage('Commit message generation timed out. Please try again.');
        } else {
          console.error('[GitCommitGenerator] Error:', error);
        }
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

interface Change {
  uri: vscode.Uri;
  status: number;
}

interface RepositoryState {
  indexChanges: Change[];
  workingTreeChanges: Change[];
  HEAD?: { commit?: string };
}

interface Repository {
  inputBox: { value: string };
  state: RepositoryState;
  rootUri: vscode.Uri;
  diff(staged: boolean): Promise<string>;
  getCommit(ref: string): Promise<unknown>;
}

/**
 * Find the repository that matches the currently active file or has changes.
 * Priority:
 * 1. Repository containing the active editor's file
 * 2. Repository with staged changes
 * 3. Repository with unstaged changes
 * 4. Let user pick if multiple repos exist and none match above criteria
 */
async function findActiveRepository(git: GitAPI): Promise<Repository | null> {
  const repositories = git.repositories;
  
  if (repositories.length === 0) {
    return null;
  }
  
  if (repositories.length === 1) {
    return repositories[0];
  }
  
  // Try to find repository based on active editor
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor) {
    const activeFilePath = activeEditor.document.uri.fsPath;
    for (const repo of repositories) {
      const repoPath = repo.rootUri.fsPath;
      if (activeFilePath.startsWith(repoPath)) {
        return repo;
      }
    }
  }
  
  // Find repositories with staged changes
  const reposWithStagedChanges = repositories.filter(
    repo => repo.state.indexChanges.length > 0
  );
  
  if (reposWithStagedChanges.length === 1) {
    return reposWithStagedChanges[0];
  }
  
  // Find repositories with any changes (staged or unstaged)
  const reposWithChanges = repositories.filter(
    repo => repo.state.indexChanges.length > 0 || repo.state.workingTreeChanges.length > 0
  );
  
  if (reposWithChanges.length === 1) {
    return reposWithChanges[0];
  }
  
  // Multiple repos with changes or no clear match - let user pick
  const reposToShow = reposWithChanges.length > 0 ? reposWithChanges : repositories;
  
  const items = reposToShow.map(repo => {
    const repoName = repo.rootUri.fsPath.split(/[/\\]/).pop() || repo.rootUri.fsPath;
    const stagedCount = repo.state.indexChanges.length;
    const unstagedCount = repo.state.workingTreeChanges.length;
    const changeInfo = stagedCount > 0 || unstagedCount > 0
      ? ` (${stagedCount} staged, ${unstagedCount} unstaged)`
      : ' (no changes)';
    
    return {
      label: repoName,
      description: repo.rootUri.fsPath + changeInfo,
      repository: repo
    };
  });
  
  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select repository to generate commit message for',
    title: 'Multiple Git Repositories Found'
  });
  
  return selected?.repository ?? null;
}
