import { useRef, useState } from "react";
import type { ImageAttachment } from "../types";

const VALID_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGES = 5;

function fileToAttachment(file: File): Promise<ImageAttachment> {
  return new Promise((resolve, reject) => {
    if (!VALID_IMAGE_TYPES.includes(file.type)) {
      reject(new Error(`Unsupported format: ${file.type}`));
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      reject(new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB (max 10 MB)`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve({
        id: crypto.randomUUID(),
        base64: dataUrl.split(",")[1],
        mediaType: file.type,
        previewUrl: dataUrl,
        name: file.name || "clipboard.png",
      });
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function useImageAttachments() {
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const newAttachments = await Promise.all(files.map(fileToAttachment));
    setAttachments((prev) => [...prev, ...newAttachments].slice(0, MAX_IMAGES));
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      await addFiles(imageFiles);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    await addFiles(files);
    e.target.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const clearAttachments = () => setAttachments([]);

  return {
    attachments,
    fileInputRef,
    handlePaste,
    handleFileSelect,
    removeAttachment,
    clearAttachments,
  };
}
