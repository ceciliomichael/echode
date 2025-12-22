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
  /** Ref that always holds current attachments - use in callbacks to avoid stale closures */
  attachmentsRef: React.RefObject<DocumentAttachment[]>;
  /** Ref that always holds current image attachments - use in callbacks to avoid stale closures */
  imageAttachmentsRef: React.RefObject<ImageAttachment[]>;
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
  // Refs that always hold current state - synced immediately on set
  const attachmentsRef = useRef<DocumentAttachment[]>(initialAttachments);
  const imageAttachmentsRef = useRef<ImageAttachment[]>(initialImageAttachments);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Custom state with immediate ref sync to avoid stale closures
  const [attachments, setAttachmentsState] = useState<DocumentAttachment[]>(initialAttachments);
  const [imageAttachments, setImageAttachmentsState] = useState<ImageAttachment[]>(initialImageAttachments);
  
  // Wrapper setters that sync ref immediately (before React batches state updates)
  const setAttachments: React.Dispatch<React.SetStateAction<DocumentAttachment[]>> = useCallback((action) => {
    setAttachmentsState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      attachmentsRef.current = next; // Sync ref immediately
      return next;
    });
  }, []);
  
  const setImageAttachments: React.Dispatch<React.SetStateAction<ImageAttachment[]>> = useCallback((action) => {
    setImageAttachmentsState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      imageAttachmentsRef.current = next; // Sync ref immediately
      return next;
    });
  }, []);

  const totalAttachments = attachments.length + imageAttachments.length;
  const canAddMore = totalAttachments < maxAttachments;

  const handleAttachmentClick = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  const handleFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {return;}

    // Use refs to get current counts (avoids stale closure)
    const currentTotal = attachmentsRef.current.length + imageAttachmentsRef.current.length;
    const remainingSlots = maxAttachments - currentTotal;
    if (remainingSlots <= 0) {return;}

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
  }, [maxAttachments, setAttachments, setImageAttachments]);

  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleRemoveImageAttachment = useCallback((index: number) => {
    setImageAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
    setImageAttachments([]);
    // Also clear refs immediately
    attachmentsRef.current = [];
    imageAttachmentsRef.current = [];
  }, [setAttachments, setImageAttachments]);

  return {
    // State
    attachments,
    imageAttachments,
    totalAttachments,
    canAddMore,
    // Refs
    fileInputRef,
    attachmentsRef,
    imageAttachmentsRef,
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