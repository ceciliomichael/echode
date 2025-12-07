/**
 * Document attachment utilities for handling text/code file attachments
 */

export interface DocumentAttachment {
  name: string;
  size: number;
  mimeType: string;
  content: string; // text content (possibly truncated)
}

// Constants
const MAX_DOCUMENT_FILE_SIZE = 512 * 1024; // 512 KB
const MAX_DOCUMENT_CONTENT_CHARS = 8000; // Match read_file truncation

// Allowed document extensions (text/code files)
const ALLOWED_EXTENSIONS = [
  '.sh', '.bash', '.zsh',
  '.txt', '.md', '.markdown',
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.jsonc',
  '.py', '.pyw',
  '.java', '.kt', '.kts',
  '.cs', '.fs',
  '.go',
  '.rs',
  '.cpp', '.c', '.cc', '.cxx', '.h', '.hpp', '.hxx',
  '.rb',
  '.php',
  '.swift',
  '.yaml', '.yml',
  '.toml', '.ini', '.cfg', '.conf',
  '.xml', '.html', '.htm', '.css', '.scss', '.sass', '.less',
  '.sql',
  '.r',
  '.lua',
  '.pl', '.pm',
  '.env', '.env.local', '.env.development', '.env.production',
  '.gitignore', '.dockerignore',
  '.dockerfile',
  '.makefile',
  '.cmake',
  '.gradle',
  '.properties',
  '.log',
  '.csv',
];

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'text/html',
  'text/css',
  'text/javascript',
  'text/typescript',
  'text/x-python',
  'text/x-java',
  'text/x-c',
  'text/x-c++',
  'text/x-go',
  'text/x-rust',
  'text/x-ruby',
  'text/x-php',
  'text/x-swift',
  'text/yaml',
  'text/x-yaml',
  'text/xml',
  'text/csv',
  'application/json',
  'application/javascript',
  'application/typescript',
  'application/xml',
  'application/x-yaml',
  'application/x-sh',
];

export interface DocumentValidationResult {
  valid: boolean;
  error?: string;
}

const ATTACHED_FILE_BLOCK_REGEX = /<attached_file>\s*([\s\S]*?)<\/attached_file>/g;

/**
 * Get file extension from filename (lowercase, with dot)
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Check if a file is a known text/code document by extension or MIME type
 */
function isTextDocument(file: File): boolean {
  const ext = getFileExtension(file.name);
  
  // Check extension first (more reliable)
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    return true;
  }
  
  // Check MIME type as fallback
  if (ALLOWED_MIME_TYPES.includes(file.type)) {
    return true;
  }
  
  // Check if MIME starts with text/
  if (file.type.startsWith('text/')) {
    return true;
  }
  
  return false;
}

/**
 * Validate a document file
 */
export function validateDocumentFile(file: File): DocumentValidationResult {
  // Check if it's a text/code document
  if (!isTextDocument(file)) {
    return {
      valid: false,
      error: 'Invalid file type. Only text and code documents are supported (.sh, .txt, .md, .ts, .js, .py, etc.)',
    };
  }
  
  // Check file size
  if (file.size > MAX_DOCUMENT_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${MAX_DOCUMENT_FILE_SIZE / 1024}KB`,
    };
  }
  
  return { valid: true };
}

/**
 * Truncate content to max chars with suffix
 */
function truncateContent(content: string, maxChars: number): string {
  if (content.length <= maxChars) {
    return content;
  }
  return `${content.slice(0, maxChars)}\n...[truncated file content]`;
}

/**
 * Read a File as text and create a DocumentAttachment
 */
export async function fileToDocumentAttachment(file: File): Promise<DocumentAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      const rawContent = reader.result as string;
      const content = truncateContent(rawContent, MAX_DOCUMENT_CONTENT_CHARS);
      
      resolve({
        name: file.name,
        size: file.size,
        mimeType: file.type || 'text/plain',
        content,
      });
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
}

/**
 * Process multiple document files
 */
export async function processDocumentFiles(
  files: FileList,
  maxCount: number = 3
): Promise<{ attachments: DocumentAttachment[]; errors: string[] }> {
  const attachments: DocumentAttachment[] = [];
  const errors: string[] = [];
  
  const filesToProcess = Array.from(files).slice(0, maxCount);
  
  for (const file of filesToProcess) {
    const validation = validateDocumentFile(file);
    
    if (!validation.valid) {
      errors.push(`${file.name}: ${validation.error}`);
      continue;
    }
    
    try {
      const attachment = await fileToDocumentAttachment(file);
      attachments.push(attachment);
    } catch {
      errors.push(`${file.name}: Failed to read file`);
    }
  }
  
  return { attachments, errors };
}

/**
 * Build an <attached_file> block for a document attachment
 */
export function buildAttachedFileBlock(attachment: DocumentAttachment): string {
  return `<attached_file>
${attachment.name}
${attachment.content}
</attached_file>`;
}

/**
 * Build all <attached_file> blocks for multiple attachments
 */
export function buildAllAttachedFileBlocks(attachments: DocumentAttachment[]): string {
  if (attachments.length === 0) return '';
  return '\n\n' + attachments.map(buildAttachedFileBlock).join('\n\n');
}

/**
 * Strip all <attached_file> blocks from a content string.
 * Used for UI display (message bubbles, history titles) where we
 * don't want to show the raw attachment markup or contents.
 */
export function stripAttachedFileBlocks(content: string): string {
  return content.replace(ATTACHED_FILE_BLOCK_REGEX, '').trimEnd();
}

/**
 * Extract plain text and DocumentAttachment[] from a content string
 * that may contain one or more <attached_file> blocks.
 *
 * The returned text has all blocks removed; attachments are reconstructed
 * from the filename + content inside each block.
 */
export function extractTextAndAttachmentsFromContent(
  content: string
): { text: string; attachments: DocumentAttachment[] } {
  const attachments: DocumentAttachment[] = [];

  const regex = /<attached_file>\s*([\s\S]*?)<\/attached_file>/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const blockBody = match[1].trimStart();
    const lines = blockBody.split('\n');
    const name = (lines[0] || '').trim();
    const fileContent = lines.slice(1).join('\n').trimStart();

    if (name) {
      attachments.push({
        name,
        size: 0,
        mimeType: 'text/plain',
        content: fileContent,
      });
    }
  }

  const text = content.replace(regex, '').trimEnd();

  return { text, attachments };
}
