import { useState } from "react";

interface UseClipboardOptions {
  timeout?: number;
}

interface UseClipboardReturn {
  copied: boolean;
  copy: (text: string) => Promise<void>;
}

/**
 * Hook for copying text to clipboard with visual feedback
 * @param options - Configuration options
 * @param options.timeout - Duration in ms before copied state resets (default: 2000)
 */
export function useClipboard(
  options: UseClipboardOptions = {},
): UseClipboardReturn {
  const { timeout = 2000 } = options;
  const [copied, setCopied] = useState(false);

  const copy = async (text: string) => {
    try {
      // Check if Clipboard API is available
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), timeout);
      } else {
        // Fallback for browsers/environments without Clipboard API
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
          const successful = document.execCommand("copy");
          if (successful) {
            setCopied(true);
            setTimeout(() => setCopied(false), timeout);
          }
        } finally {
          document.body.removeChild(textArea);
        }
      }
    } catch {
      // Error handled silently
    }
  };

  return { copied, copy };
}
