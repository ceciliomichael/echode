import { Check, Copy, WrapText } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { useClipboard } from "../../hooks/use-clipboard";
import { getLanguageIcon } from "../../utils/file-icon-mapper";

interface CodeBlockProps {
  children: React.ReactNode;
  className?: string;
}

// Helper function to extract code content - memoized outside component
// This ensures stable comparison for memoization
const extractCodeContent = (children: React.ReactNode): string => {
  if (children === null || children === undefined) {
    return "";
  }
  if (typeof children === "string") {
    return children;
  }
  if (typeof children === "number" || typeof children === "boolean") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map((child) => extractCodeContent(child)).join("");
  }
  if (typeof children === "object" && "props" in children) {
    const props = (children as { props?: { children?: React.ReactNode } })
      .props;
    if (props?.children !== undefined) {
      return extractCodeContent(props.children);
    }
  }
  return "";
};

const CodeBlockComponent = ({ children, className }: CodeBlockProps) => {
  const { copied, copy } = useClipboard();
  const [wordWrap, setWordWrap] = useState(false);

  const language = useMemo(
    () => className?.replace("language-", "") || "text",
    [className],
  );

  const iconConfig = useMemo(() => getLanguageIcon(language), [language]);
  const LanguageIcon = iconConfig.icon;

  const codeContent = useMemo(() => extractCodeContent(children), [children]);

  const codeLines = useMemo(() => {
    const lines = codeContent.replace(/\n$/, "").split("\n");
    const maxLineNumber = lines.length;
    const paddingWidth = maxLineNumber.toString().length;
    return { lines, paddingWidth };
  }, [codeContent]);

  const handleCopy = () => copy(codeContent);
  const handleWordWrap = () => setWordWrap(!wordWrap);

  return (
    <div
      className="my-2 rounded-xl overflow-hidden border min-w-0 max-w-full"
      style={{
        borderColor: 'var(--vscode-input-border)',
        backgroundColor: 'var(--vscode-editor-background)'
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{
          borderColor: 'var(--vscode-input-border)',
          backgroundColor: 'var(--vscode-editor-background)',
          color: 'var(--vscode-descriptionForeground)'
        }}
      >
        <div className="flex items-center gap-2">
          <LanguageIcon className="w-3.5 h-3.5" style={{ color: iconConfig.color }} />
          <span
            className="text-xs font-medium"
            style={{ color: 'var(--vscode-foreground)', opacity: 0.7 }}
          >
            {iconConfig.label || language}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleWordWrap}
            className={`flex items-center py-1 rounded transition-colors ${wordWrap ? "" : ""
              }`}
            style={{
              color: wordWrap ? 'var(--vscode-button-background)' : 'var(--vscode-foreground)'
            }}
            title={wordWrap ? "Disable word wrap" : "Enable word wrap"}
          >
            <WrapText className="w-3.5 h-3.5 hover:scale-110 transition-transform" />
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center py-1 rounded transition-colors"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 hover:scale-110 transition-transform" />
            ) : (
              <Copy className="w-3.5 h-3.5 hover:scale-110 transition-transform" />
            )}
          </button>
        </div>
      </div>

      {wordWrap ? (
        <div
          className="font-mono text-xs"
          style={{
            display: "grid",
            gridTemplateColumns: "min-content 1fr",
            backgroundColor: 'var(--vscode-editor-background)',
          }}
        >
          {codeLines.lines.map((line, index) => (
            <div key={`line-${index}`} style={{ display: "contents" }}>
              <div
                className="select-none px-1.5 text-right border-r leading-[1.15rem]"
                style={{
                  color: 'var(--vscode-editorLineNumber-foreground)',
                  backgroundColor: 'var(--vscode-editorLineNumber-background)',
                  borderColor: 'var(--vscode-input-border)',
                  minWidth: '2.4rem',
                }}
              >
                {index + 1}
              </div>
              <div
                className="px-2 leading-[1.15rem] whitespace-pre-wrap break-words break-all"
                style={{
                  color: 'var(--vscode-editor-foreground)',
                  backgroundColor: 'var(--vscode-editor-background)',
                  minWidth: 0,
                }}
              >
                {line || "\u00A0"}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="flex min-w-0"
          style={{ backgroundColor: 'var(--vscode-editor-background)' }}
        >
          <div
            className="flex-shrink-0 border-r"
            style={{
              borderColor: 'var(--vscode-input-border)',
              backgroundColor: 'var(--vscode-editorLineNumber-background)'
            }}
          >
            <pre className="text-xs font-mono m-0 py-1" style={{ backgroundColor: 'transparent' }}>
              <code className="block" style={{ backgroundColor: 'transparent' }}>
                {codeLines.lines.map((_, index) => (
                  <div
                    key={`line-number-${index + 1}`}
                    className="select-none px-1.5 text-right min-h-[1.15rem] leading-[1.15rem]"
                    style={{
                      color: 'var(--vscode-editorLineNumber-foreground)',
                      minWidth: '2.4rem',
                      width: '2.4rem'
                    }}
                  >
                    {index + 1}
                  </div>
                ))}
              </code>
            </pre>
          </div>

          <div
            className="flex-1 overflow-x-auto"
          >
            <pre
              className="text-xs font-mono m-0 pl-2 pr-4 py-1 whitespace-pre"
              style={{
                color: 'var(--vscode-editor-foreground)',
                backgroundColor: 'var(--vscode-editor-background)',
                minWidth: '100%',
                width: 'fit-content',
              }}
            >
              <code className="block" style={{ backgroundColor: 'var(--vscode-editor-background)' }}>
                {codeLines.lines.map((line, index) => (
                  <div
                    key={`content-${index}-${line.slice(0, 10)}`}
                    className="min-h-[1.15rem] leading-[1.15rem] whitespace-pre"
                  >
                    {line || "\u00A0"}
                  </div>
                ))}
              </code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

// Memoize CodeBlock to prevent re-renders when parent re-renders
// Only re-renders when children or className actually change
export const CodeBlock = memo(CodeBlockComponent, (prevProps, nextProps) => {
  // Extract code content for comparison
  const prevContent = extractCodeContent(prevProps.children);
  const nextContent = extractCodeContent(nextProps.children);

  // Re-render only if code content or className changed
  return (
    prevContent === nextContent && prevProps.className === nextProps.className
  );
});
