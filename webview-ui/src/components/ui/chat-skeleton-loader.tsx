/**
 * Skeleton loader for chat history restoration.
 * Matches the actual Echode chat UI design.
 */

function SkeletonLine({ width }: { width: string }) {
  return (
    <div 
      className="h-4 rounded animate-pulse"
      style={{ 
        width,
        backgroundColor: 'var(--vscode-foreground)',
        opacity: 0.1,
      }}
    />
  );
}

function UserSkeleton({ lines }: { lines: number }) {
  const widths = lines === 1 
    ? ['55%'] 
    : lines === 2 
      ? ['70%', '45%'] 
      : ['80%', '65%', '40%'];
  
  return (
    <div className="flex w-full">
      <div 
        className="rounded-xl px-3 py-2.5 w-full border"
        style={{ 
          backgroundColor: 'var(--vscode-chat-surface)',
          borderColor: 'var(--vscode-input-border)',
        }}
      >
        <div className="space-y-2">
          {widths.map((w, i) => (
            <SkeletonLine key={i} width={w} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AssistantSkeleton({ lines }: { lines: number }) {
  const widths = lines === 3 
    ? ['90%', '85%', '60%'] 
    : ['95%', '80%', '88%', '40%'];
  
  return (
    <div className="w-full" style={{ paddingLeft: '1.25rem', paddingRight: '1.25rem' }}>
      <div className="space-y-2">
        {widths.map((w, i) => (
          <SkeletonLine key={i} width={w} />
        ))}
      </div>
    </div>
  );
}

export function ChatSkeletonLoader() {
  return (
    <div className="flex flex-col h-full py-4 space-y-3">
      <UserSkeleton lines={2} />
      <AssistantSkeleton lines={3} />
      <UserSkeleton lines={1} />
      <AssistantSkeleton lines={4} />
    </div>
  );
}