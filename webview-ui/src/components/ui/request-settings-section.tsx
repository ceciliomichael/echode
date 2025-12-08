import { useState, useMemo } from 'react';

interface RequestSettingsSectionProps {
  streamingTimeout: number;
  onStreamingTimeoutChange: (value: number) => void;
}

export function RequestSettingsSection({
  streamingTimeout,
  onStreamingTimeoutChange
}: RequestSettingsSectionProps) {
  const [isEditingTimeout, setIsEditingTimeout] = useState(false);
  const [timeoutInput, setTimeoutInput] = useState('');

  // Display value in seconds (stored in ms)
  const timeoutDisplayValue = useMemo(() => {
    if (isEditingTimeout) return timeoutInput;
    const seconds = streamingTimeout / 1000;
    return seconds === 5 ? '' : String(seconds);
  }, [streamingTimeout, isEditingTimeout, timeoutInput]);

  const handleTimeoutFocus = () => {
    setIsEditingTimeout(true);
    const seconds = streamingTimeout / 1000;
    setTimeoutInput(seconds === 5 ? '' : String(seconds));
  };

  const handleTimeoutInputChange = (value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setTimeoutInput(value);
    }
  };

  const handleTimeoutCommit = () => {
    setIsEditingTimeout(false);
    if (timeoutInput === '' || timeoutInput === '.') {
      onStreamingTimeoutChange(5000); // Default 5 seconds
      return;
    }

    const parsed = Number(timeoutInput);
    if (!Number.isNaN(parsed) && parsed > 0) {
      onStreamingTimeoutChange(parsed * 1000); // Convert to ms
    }
  };

  return (
    <div className="space-y-4">
      <h2 
        className="text-sm font-bold pb-2 border-b"
        style={{ 
          color: 'var(--vscode-foreground)',
          borderColor: 'var(--vscode-panel-border)'
        }}
      >
        Request Settings
      </h2>

      <div className="space-y-2">
        <label
          htmlFor="streamingTimeout"
          className="block text-xs font-semibold"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          Streaming Timeout (seconds)
        </label>
        <input
          id="streamingTimeout"
          type="text"
          inputMode="decimal"
          value={timeoutDisplayValue}
          onChange={(e) => handleTimeoutInputChange(e.target.value)}
          onFocus={handleTimeoutFocus}
          onBlur={handleTimeoutCommit}
          placeholder="5"
          className="w-full px-3 py-2 text-sm rounded-xl border transition-colors"
          style={{
            backgroundColor: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            borderColor: 'var(--vscode-input-border)'
          }}
        />
        <p 
          className="text-xs mt-1"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          Time to wait for streaming response before auto-retry (infinite retries)
        </p>
      </div>
    </div>
  );
}
