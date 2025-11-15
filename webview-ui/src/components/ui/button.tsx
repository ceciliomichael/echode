import { type ReactNode, type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'default' | 'secondary';
}

export function Button({ children, variant = 'default', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`flex items-center gap-1 px-3 py-2 text-sm rounded-xl border shadow-sm transition-opacity hover:opacity-90 active:opacity-80 w-fit ${className}`}
      style={{
        borderColor: 'var(--vscode-input-border)',
        color: 'var(--vscode-input-foreground)',
        backgroundColor: variant === 'secondary' ? 'var(--vscode-input-background)' : 'var(--vscode-sideBar-background)'
      }}
      {...props}
    >
      {children}
    </button>
  );
}