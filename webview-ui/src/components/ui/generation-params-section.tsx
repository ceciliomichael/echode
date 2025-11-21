import { useState, useMemo } from 'react';

interface GenerationParamsSectionProps {
  maxTokens: number;
  temperature: number;
  onMaxTokensChange: (value: number) => void;
  onTemperatureChange: (value: number) => void;
}

export function GenerationParamsSection({
  maxTokens,
  temperature,
  onMaxTokensChange,
  onTemperatureChange
}: GenerationParamsSectionProps) {
  const [isEditingMaxTokens, setIsEditingMaxTokens] = useState(false);
  const [maxTokensInput, setMaxTokensInput] = useState('');
  const [isEditingTemperature, setIsEditingTemperature] = useState(false);
  const [temperatureInput, setTemperatureInput] = useState('');

  const maxTokensDisplayValue = useMemo(() => {
    return isEditingMaxTokens ? maxTokensInput : 
           (maxTokens === undefined || Number.isNaN(maxTokens) || maxTokens === 8192 ? '' : String(maxTokens));
  }, [maxTokens, isEditingMaxTokens, maxTokensInput]);

  const temperatureDisplayValue = useMemo(() => {
    return isEditingTemperature ? temperatureInput : 
           (temperature === undefined || Number.isNaN(temperature) || temperature === 0 ? '' : String(temperature));
  }, [temperature, isEditingTemperature, temperatureInput]);

  const handleMaxTokensFocus = () => {
    setIsEditingMaxTokens(true);
    setMaxTokensInput(maxTokens === undefined || Number.isNaN(maxTokens) || maxTokens === 8192 ? '' : String(maxTokens));
  };

  const handleMaxTokensInputChange = (value: string) => {
    if (value === '' || /^\d+$/.test(value)) {
      setMaxTokensInput(value);
    }
  };

  const handleMaxTokensCommit = () => {
    setIsEditingMaxTokens(false);
    if (maxTokensInput === '') {
      onMaxTokensChange(8192);
      return;
    }

    const parsed = Number(maxTokensInput);
    if (!Number.isNaN(parsed)) {
      onMaxTokensChange(parsed);
    }
  };

  const handleTemperatureFocus = () => {
    setIsEditingTemperature(true);
    setTemperatureInput(temperature === undefined || Number.isNaN(temperature) || temperature === 0 ? '' : String(temperature));
  };

  const handleTemperatureInputChange = (value: string) => {
    if (/^\d*\.?\d*$/.test(value)) {
      setTemperatureInput(value);
    }
  };

  const handleTemperatureCommit = () => {
    setIsEditingTemperature(false);
    if (temperatureInput === '' || temperatureInput === '.') {
      onTemperatureChange(0);
      return;
    }

    const parsed = Number(temperatureInput);
    if (!Number.isNaN(parsed)) {
      onTemperatureChange(parsed);
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
        Generation Parameters
      </h2>

      <div className="space-y-2">
        <label
          htmlFor="maxTokens"
          className="block text-xs font-semibold"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          Max Tokens (Optional)
        </label>
        <input
          id="maxTokens"
          type="text"
          inputMode="numeric"
          value={maxTokensDisplayValue}
          onChange={(e) => handleMaxTokensInputChange(e.target.value)}
          onFocus={handleMaxTokensFocus}
          onBlur={handleMaxTokensCommit}
          placeholder="8192"
          className="w-full px-3 py-2 text-sm rounded-xl border transition-colors"
          style={{
            backgroundColor: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            borderColor: 'var(--vscode-input-border)'
          }}
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="temperature"
          className="block text-xs font-semibold"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          Temperature (Optional)
        </label>
        <input
          id="temperature"
          type="text"
          inputMode="decimal"
          value={temperatureDisplayValue}
          onChange={(e) => handleTemperatureInputChange(e.target.value)}
          onFocus={handleTemperatureFocus}
          onBlur={handleTemperatureCommit}
          placeholder="0"
          className="w-full px-3 py-2 text-sm rounded-xl border transition-colors"
          style={{
            backgroundColor: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            borderColor: 'var(--vscode-input-border)'
          }}
        />
      </div>
    </div>
  );
}
