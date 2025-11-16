import type { InputHTMLAttributes } from 'react';

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

/**
 * Reusable form input component with consistent VSCode theming
 * Eliminates repetitive input styling across api-config-tab and other forms
 */
export function FormInput({ label, error, id, className = '', ...props }: FormInputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-2">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-3 py-2 text-sm rounded-xl border transition-colors ${className}`}
        style={{
          backgroundColor: 'var(--vscode-input-background)',
          color: 'var(--vscode-input-foreground)',
          borderColor: 'var(--vscode-input-border)',
        }}
        {...props}
      />
      {error && (
        <p className="text-xs" style={{ color: 'var(--vscode-errorForeground)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
