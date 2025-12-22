import { memo, useState } from 'react';
import { CompressedBlockHeader } from './compressed-block-header.tsx';
import { CompressedBlockContent } from './compressed-block-content.tsx';

interface CompressedBlockProps {
  content: string;
}

const CompressedBlockComponent = ({ content }: CompressedBlockProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Extract content from <compressed_history> tags
  const compressedMatch = content.match(/<compressed_history>([\s\S]*?)<\/compressed_history>/);
  const compressedContent = compressedMatch ? compressedMatch[1].trim() : content;

  return (
    <div
      className="overflow-hidden w-full mt-2"
      style={{
        borderColor: 'var(--vscode-input-border)',
        backgroundColor: 'var(--vscode-editor-background)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderRadius: '0.75rem',
      }}
    >
      <CompressedBlockHeader
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
      />

      <CompressedBlockContent
        content={compressedContent}
        isExpanded={isExpanded}
      />
    </div>
  );
};

export const CompressedBlock = memo(CompressedBlockComponent);