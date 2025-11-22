export function LoadingDots() {
  return (
    <>
      <style>
        {`
          @keyframes wave-shine {
            0% {
              background-position: 200% 0;
            }
            100% {
              background-position: -100% 0;
            }
          }
        `}
      </style>
      <span
        className="text-sm"
        style={{
          background:
            'linear-gradient(90deg, var(--vscode-descriptionForeground) 0%, var(--vscode-descriptionForeground) 40%, var(--vscode-foreground) 50%, var(--vscode-descriptionForeground) 60%, var(--vscode-descriptionForeground) 100%)',
          backgroundSize: '300% 100%',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: 'wave-shine 2s linear infinite',
        }}
      >
        Executing
      </span>
    </>
  );
}