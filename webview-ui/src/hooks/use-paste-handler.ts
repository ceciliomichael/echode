import { type ClipboardEvent, useCallback } from 'react';
import { validateDocumentFile, fileToDocumentAttachment, type DocumentAttachment } from '../utils/document-utils';
import { validateImageFile, fileToImageAttachment } from '../utils/image-utils';
import type { ImageAttachment } from '../types/chat';

interface UsePasteHandlerProps {
    attachments: DocumentAttachment[];
    setAttachments: (value: React.SetStateAction<DocumentAttachment[]>) => void;
    imageAttachments: ImageAttachment[];
    setImageAttachments: (value: React.SetStateAction<ImageAttachment[]>) => void;
    disabled?: boolean;
    maxAttachments?: number;
}

export function usePasteHandler({
    attachments,
    setAttachments,
    imageAttachments,
    setImageAttachments,
    disabled = false,
    maxAttachments = 3
}: UsePasteHandlerProps) {

    const handlePaste = useCallback(async (e: ClipboardEvent<HTMLTextAreaElement>) => {
        if (disabled) {
            return;
        }

        const clipboard = e.clipboardData;
        if (!clipboard) {
            return;
        }

        const files = clipboard.files;
        if (!files || files.length === 0) {
            return;
        }

        const currentTotal = attachments.length + imageAttachments.length;

        if (currentTotal >= maxAttachments) {
            return;
        }

        e.preventDefault();

        const remainingSlots = maxAttachments - currentTotal;
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

        if (docFiles.length === 0 && imgFiles.length === 0) {
            return;
        }

        const limitedDocFiles = docFiles.slice(0, remainingSlots);
        const remainingAfterDocs = remainingSlots - limitedDocFiles.length;
        const limitedImgFiles = remainingAfterDocs > 0 ? imgFiles.slice(0, remainingAfterDocs) : [];

        const newDocAttachments: DocumentAttachment[] = [];
        const newImageAttachments: ImageAttachment[] = [];

        for (const file of limitedDocFiles) {
            const validation = validateDocumentFile(file);
            if (!validation.valid) {
                console.error('Document processing error for pasted file:', `${file.name}: ${validation.error}`);
                continue;
            }
            try {
                const attachment = await fileToDocumentAttachment(file);
                newDocAttachments.push(attachment);
            } catch {
                console.error('Document processing error for pasted file:', `${file.name}: Failed to read file`);
            }
        }

        for (const file of limitedImgFiles) {
            const validation = validateImageFile(file);
            if (!validation.valid) {
                console.error('Image processing error for pasted file:', `${file.name}: ${validation.error}`);
                continue;
            }
            try {
                const attachment = await fileToImageAttachment(file);
                newImageAttachments.push(attachment);
            } catch {
                console.error('Image processing error for pasted file:', `${file.name}: Failed to process`);
            }
        }

        if (newDocAttachments.length > 0) {
            setAttachments(prev => [...prev, ...newDocAttachments]);
        }

        if (newImageAttachments.length > 0) {
            setImageAttachments(prev => [...prev, ...newImageAttachments]);
        }
    }, [attachments, imageAttachments, disabled, maxAttachments, setAttachments, setImageAttachments]);

    return { handlePaste };
}
