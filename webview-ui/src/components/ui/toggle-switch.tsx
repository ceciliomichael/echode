interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}

export function ToggleSwitch({ checked, onChange, disabled = false }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className="relative inline-flex items-center w-11 h-6 rounded-full transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
      style={{
        backgroundColor: checked
          ? 'var(--vscode-button-background)'
          : 'var(--vscode-input-border)',
      }}
    >
      <span
        className="inline-block w-4 h-4 rounded-full transition-transform duration-200 shadow-sm"
        style={{
          backgroundColor: '#ffffff',
          transform: checked ? 'translateX(24px)' : 'translateX(4px)',
        }}
      />
    </button>
  );
}
