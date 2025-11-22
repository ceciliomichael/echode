import type { ImageAttachment } from '../types/chat';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate image file
 */
export function validateImageFile(file: File): ImageValidationResult {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
    };
  }

  return { valid: true };
}

/**
 * Convert File to base64 ImageAttachment
 */
export async function fileToImageAttachment(file: File): Promise<ImageAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64Data = result.split(',')[1];
      
      resolve({
        data: base64Data,
        mimeType: file.type,
        size: file.size,
        name: file.name
      });
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Process multiple files and convert to attachments
 */
export async function processImageFiles(
  files: FileList,
  maxCount: number = 3
): Promise<{ attachments: ImageAttachment[]; errors: string[] }> {
  const attachments: ImageAttachment[] = [];
  const errors: string[] = [];

  const filesToProcess = Array.from(files).slice(0, maxCount);

  for (const file of filesToProcess) {
    const validation = validateImageFile(file);
    
    if (!validation.valid) {
      errors.push(`${file.name}: ${validation.error}`);
      continue;
    }

    try {
      const attachment = await fileToImageAttachment(file);
      attachments.push(attachment);
    } catch {
      errors.push(`${file.name}: Failed to process`);
    }
  }

  return { attachments, errors };
}
