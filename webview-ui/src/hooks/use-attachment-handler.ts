import { useState, useRef, useCallback, type ChangeEvent } from 'react';
import { 
  processDocumentFiles, 
  validateDocumentFile, 
  type DocumentAttachment 
} from '../utils/document-utils';
import { validateImageFile, processImageFiles } from '../utils/image-utils';
import type { ImageAttachment } from '../types/chat';

interface UseAttachmentHandlerOptions {
  initialAttachments?: DocumentAttachment[];
  initialImageAttachments?: ImageAttachment[];
  maxAttachments?: number;
  disabled?: boolean;
}

interface AttachmentState {
  attachments: DocumentAttachment[];
  imageAttachments: ImageAttachment[];
}

interface AttachmentHandlers {
  handleFileChange: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleRemoveAttachment: (index: number) => void;
  handleRemoveImageAttachment: (index: number) => void;
  handleAttachmentClick: () => void;
  clearAttachments: () => void;
  setAttachments: React.Dispatch<React.SetStateAction<DocumentAttachment[]>>;
  setImageAttachments: React.Dispatch<React.SetStateAction<ImageAttachment[]>>;
}

export interface UseAttachmentHandlerReturn extends AttachmentState, AttachmentHandlers {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  totalAttachments: number;
  canAddMore: boolean;
}

/**
 * Helper to create a FileList-like object from File array
 */
function createFileList(files: File[]): FileList {
  const dataTransfer = new DataTransfer();
  files.forEach(file => dataTransfer.items.add(file));
  return dataTransfer.files;
}

export function useAttachmentHandler({
  initialAttachments = [],
  initialImageAttachments = [],
  maxAttachments = 3,
  disabled = false
}: UseAttachmentHandlerOptions = {}): UseAttachmentHandlerReturn {
  const [attachments, setAttachments] = useState<DocumentAttachment[]>(initialAttachments);
  const [imageAttachments, setImageAttachments] = useState<ImageAttachment[]>(initialImageAttachments);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const totalAttachments = attachments.length + imageAttachments.length;
  const canAddMore = totalAttachments < maxAttachments;

  const handleAttachmentClick = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  const handleFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentTotal = attachments.length + imageAttachments.length;
    const remainingSlots = maxAttachments - currentTotal;
    if (remainingSlots <= 0) return;

    // Separate files into documents and images
    const filesArray = Array.from(files);
    const docFiles: File[] = [];
    const imgFiles: File[] = [];

    for (const file of filesArray) {
      if (validateDocumentFile(file).valid) {
        docFiles.push(file);
      } else if (validateImageFile(file).valid) {
        imgFiles.push(file);
      }
    }

    // Process document files first
    let usedSlots = 0;
    if (docFiles.length > 0) {
      const docFileList = createFileList(docFiles);
      const { attachments: newDocAttachments, errors: docErrors } = await processDocumentFiles(docFileList, remainingSlots);
      if (docErrors.length > 0) {
        console.error('Document processing errors:', docErrors);
      }
      if (newDocAttachments.length > 0) {
        setAttachments(prev => [...prev, ...newDocAttachments]);
        usedSlots += newDocAttachments.length;
      }
    }

    // Process image files with remaining slots
    const remainingAfterDocs = remainingSlots - usedSlots;
    if (imgFiles.length > 0 && remainingAfterDocs > 0) {
      const imgFileList = createFileList(imgFiles);
      const { attachments: newImgAttachments, errors: imgErrors } = await processImageFiles(imgFileList, remainingAfterDocs);
      if (imgErrors.length > 0) {
        console.error('Image processing errors:', imgErrors);
      }
      if (newImgAttachments.length > 0) {
        setImageAttachments(prev => [...prev, ...newImgAttachments]);
      }
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [attachments.length, imageAttachments.length, maxAttachments]);

  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleRemoveImageAttachment = useCallback((index: number) => {
    setImageAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
    setImageAttachments([]);
  }, []);

  return {
    // State
    attachments,
    imageAttachments,
    totalAttachments,
    canAddMore,
    // Refs
    fileInputRef,
    // Handlers
    handleFileChange,
    handleRemoveAttachment,
    handleRemoveImageAttachment,
    handleAttachmentClick,
    clearAttachments,
    setAttachments,
    setImageAttachments
  };
}