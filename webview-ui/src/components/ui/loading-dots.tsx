export function LoadingDots() {
  return (
    <div className="flex gap-0.5 py-0.5">
      <div
        className="w-1 h-1 rounded-full animate-bounce"
        style={{
          backgroundColor: 'var(--vscode-editor-foreground)',
          opacity: 0.6,
          animationDelay: '0ms'
        }}
      />
      <div
        className="w-1 h-1 rounded-full animate-bounce"
        style={{
          backgroundColor: 'var(--vscode-editor-foreground)',
          opacity: 0.6,
          animationDelay: '150ms'
        }}
      />
      <div
        className="w-1 h-1 rounded-full animate-bounce"
        style={{
          backgroundColor: 'var(--vscode-editor-foreground)',
          opacity: 0.6,
          animationDelay: '300ms'
        }}
      />
    </div>
  );
}