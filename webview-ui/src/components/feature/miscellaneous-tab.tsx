import { Settings2, AlertTriangle } from 'lucide-react';
import { ToggleSwitch } from '../ui/toggle-switch';
import type { MiscellaneousSettings, Tool } from '../../types/api-settings';

interface MiscellaneousTabProps {
  miscellaneousSettings: MiscellaneousSettings;
  enabledTools: Tool[];
  onChange: (settings: MiscellaneousSettings) => void;
}

export function MiscellaneousTab({ 
  miscellaneousSettings, 
  enabledTools, 
  onChange 
}: MiscellaneousTabProps) {
  // Check if run_terminal tool is enabled
  const runTerminalTool = enabledTools.find(t => t.id === 'run_terminal');
  const isRunTerminalEnabled = runTerminalTool?.enabled ?? false;

  const handleToggleFullTerminalAccess = () => {
    onChange({ 
      ...miscellaneousSettings, 
      enableFullTerminalAccess: !miscellaneousSettings.enableFullTerminalAccess 
    });
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div 
          className="flex items-center gap-2 mb-2"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          <Settings2 size={18} strokeWidth={1.5} />
          <h2 className="text-base sm:text-lg font-semibold">Miscellaneous</h2>
        </div>
        <p 
          className="text-xs sm:text-sm"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          Advanced configuration options for power users.
        </p>
      </div>

      {/* Terminal Access Section */}
      <div className="space-y-4">
        <h2
          className="text-sm font-bold pb-2 border-b"
          style={{
            color: 'var(--vscode-foreground)',
            borderColor: 'var(--vscode-panel-border)',
          }}
        >
          Terminal Access
        </h2>

        <div
          className={`flex items-start justify-between gap-4 p-4 rounded-xl border ${
            !isRunTerminalEnabled ? 'opacity-50' : ''
          }`}
          style={{
            backgroundColor: 'var(--vscode-input-background)',
            borderColor: miscellaneousSettings.enableFullTerminalAccess && isRunTerminalEnabled
              ? 'var(--vscode-focusBorder)'
              : 'var(--vscode-input-border)',
          }}
        >
          <div className="flex-1">
            <p
              className="text-sm font-medium mb-1"
              style={{ color: 'var(--vscode-foreground)' }}
            >
              Enable Full Terminal Access
            </p>
            <p
              className="text-xs leading-relaxed"
              style={{ color: 'var(--vscode-descriptionForeground)' }}
            >
              Bypass command restrictions and allow execution of all terminal commands, 
              including development servers and long-running processes.
            </p>

            {/* Warning when enabled */}
            {miscellaneousSettings.enableFullTerminalAccess && isRunTerminalEnabled && (
              <div 
                className="flex items-start gap-2 mt-3 p-2 rounded-lg"
                style={{ 
                  backgroundColor: 'var(--vscode-inputValidation-warningBackground)',
                  border: '1px solid var(--vscode-inputValidation-warningBorder)'
                }}
              >
                <AlertTriangle 
                  size={14} 
                  className="flex-shrink-0 mt-0.5"
                  style={{ color: 'var(--vscode-editorWarning-foreground)' }}
                />
                <p 
                  className="text-xs"
                  style={{ color: 'var(--vscode-foreground)' }}
                >
                  Use with caution. Long-running processes may block the agent until timeout.
                </p>
              </div>
            )}

            {/* Info when run_terminal is disabled */}
            {!isRunTerminalEnabled && (
              <p
                className="text-xs mt-2 italic"
                style={{ color: 'var(--vscode-descriptionForeground)' }}
              >
                Enable the "Run Terminal" tool in the Tools tab to use this option.
              </p>
            )}
          </div>

          <ToggleSwitch
            checked={miscellaneousSettings.enableFullTerminalAccess}
            onChange={handleToggleFullTerminalAccess}
            disabled={!isRunTerminalEnabled}
          />
        </div>
      </div>
    </div>
  );
}