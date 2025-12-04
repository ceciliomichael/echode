import type { EchoSearchProgress } from '../../../types/tool';
import { getToolIconConfig, parseToolCall } from './utils';

/**
 * Splash texts for echo_search progress based on phase
 */
const PHASE_SPLASH_TEXTS: Record<EchoSearchProgress['phase'], string[]> = {
  starting: ['Initializing search...'],
  thinking: [
    'Analyzing query...',
    'Planning search strategy...',
    'Identifying patterns...',
    'Formulating approach...',
  ],
  executing: [
    'Searching codebase...',
    'Finding relevant files...',
    'Exploring directories...',
    'Scanning for matches...',
  ],
  finalizing: ['Synthesizing results...'],
};

/**
 * Get splash text based on phase and iteration
 */
function getSplashText(phase: EchoSearchProgress['phase'], iteration: number): string {
  const texts = PHASE_SPLASH_TEXTS[phase];
  return texts[iteration % texts.length];
}

/**
 * Progress indicator for echo_search tool - shows tools like final result snippets
 */
export function EchoSearchProgressIndicator({ progress }: { progress: EchoSearchProgress }) {
  const splashText = getSplashText(progress.phase, progress.iteration);
  // Only show iteration counter when we have tools, using toolsIteration for accurate display
  const showIterationCounter = progress.toolsIteration > 0 && progress.tools.length > 0;

  return (
    <div className="rounded-md overflow-hidden border border-[var(--vscode-input-border)] bg-[var(--vscode-editor-background)]">
      {/* Header with splash text and iteration counter */}
      <div
        className="px-3 py-1.5 border-b border-[var(--vscode-input-border)] flex items-center justify-between text-xs"
      >
        <style>
          {`
            @keyframes wave-shine {
              0% { background-position: 200% 0; }
              100% { background-position: -100% 0; }
            }
          `}
        </style>
        <span
          className="font-medium flex items-center gap-1.5"
          style={{
            background: 'linear-gradient(90deg, var(--vscode-descriptionForeground) 0%, var(--vscode-descriptionForeground) 40%, var(--vscode-foreground) 50%, var(--vscode-descriptionForeground) 60%, var(--vscode-descriptionForeground) 100%)',
            backgroundSize: '300% 100%',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'wave-shine 2s linear infinite',
          }}
        >
          {splashText}
        </span>
        {showIterationCounter && (
          <span
            className="font-medium"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
          >
            {progress.toolsIteration}/{progress.maxIterations}
          </span>
        )}
      </div>

      {/* Tool List */}
      <div>
        {progress.tools.length > 0 && (
          progress.tools.map((toolCall, idx) => {
            const { tool, param } = parseToolCall(toolCall);
            const iconConfig = getToolIconConfig(toolCall);
            const Icon = iconConfig.icon;
            
            return (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-2 border-b border-[var(--vscode-input-border)] last:border-b-0"
              >
                <Icon
                  className="w-3.5 h-3.5 flex-shrink-0"
                  style={{ color: iconConfig.color }}
                />
                <span
                  className="text-xs font-medium truncate flex-1"
                  style={{ color: 'var(--vscode-foreground)' }}
                >
                  {param || tool}
                </span>
                <span
                  className="text-xs opacity-50"
                  style={{ color: 'var(--vscode-descriptionForeground)' }}
                >
                  {tool}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}