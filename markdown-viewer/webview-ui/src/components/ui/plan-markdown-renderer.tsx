import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { usePlanMarkdownComponents } from './plan-markdown-components';

interface PlanMarkdownRendererProps {
  content: string;
}

export const PlanMarkdownRenderer = memo(function PlanMarkdownRenderer({ content }: PlanMarkdownRendererProps) {
  const processedContent = useMemo(() => {
    const lines = content.split('\n');
    let inCodeBlock = false;
    const isTableLine = new Array(lines.length).fill(false);
    
    for (let i = 0; i < lines.length; i++) {
      let trimmed = lines[i].trim();
      if (trimmed.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      
      if (!inCodeBlock) {
        while (trimmed.startsWith('>')) {
          trimmed = trimmed.substring(1).trim();
        }
        if (/^[ \t|:-]+$/.test(trimmed) && trimmed.includes('|') && trimmed.includes('-')) {
          isTableLine[i] = true;
          
          let j = i - 1;
          while (j >= 0 && !isTableLine[j] && lines[j].includes('|') && !lines[j].trim().startsWith('```')) {
            isTableLine[j] = true;
            j--;
          }
          
          j = i + 1;
          while (j < lines.length && !isTableLine[j] && lines[j].includes('|') && !lines[j].trim().startsWith('```')) {
            isTableLine[j] = true;
            j++;
          }
        }
      }
    }

    for (let i = 0; i < lines.length; i++) {
      if (isTableLine[i]) {
        lines[i] = lines[i].replace(/(`+)([^`]+)\1/g, (_match, backticks, codeContent) => {
          return backticks + codeContent.replace(/(?<!\\)\|/g, '\\|') + backticks;
        });
      }
    }
    
    return lines.join('\n');
  }, [content]);

  const markdownComponents = usePlanMarkdownComponents();

  return (
    <ReactMarkdown 
      components={markdownComponents}
      remarkPlugins={[remarkGfm]}
    >
      {processedContent}
    </ReactMarkdown>
  );
}, (prev, next) => prev.content === next.content);
