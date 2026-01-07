import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from '../config/r2.js';
import { v4 as uuidv4 } from 'uuid';

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  IMAGE: 2 * 1024 * 1024,      // 2MB for images
  DOCUMENT: 5 * 1024 * 1024,   // 5MB for documents
  DEFAULT: 5 * 1024 * 1024,    // 5MB default
} as const;

interface UploadResult {
  key: string;
  url: string;
}

export async function uploadToR2(
  file: Buffer,
  filename: string,
  contentType: string,
  folder: string = 'uploads'
): Promise<UploadResult> {
  const extension = filename.split('.').pop() || '';
  const key = `${folder}/${uuidv4()}.${extension}`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: file,
      ContentType: contentType,
    })
  );

  return {
    key,
    url: `${R2_PUBLIC_URL}/${key}`,
  };
}

export async function deleteFromR2(key: string): Promise<void> {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    })
  );
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export function isValidImageType(contentType: string): boolean {
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  return validTypes.includes(contentType);
}

export function isValidDocumentType(contentType: string): boolean {
  const validTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  return validTypes.includes(contentType);
}

export function validateFileSize(
  fileSize: number,
  contentType: string
): { valid: boolean; error?: string } {
  const isImage = isValidImageType(contentType);
  const limit = isImage ? FILE_SIZE_LIMITS.IMAGE : FILE_SIZE_LIMITS.DOCUMENT;
  const limitMB = limit / (1024 * 1024);

  if (fileSize > limit) {
    return {
      valid: false,
      error: `File size exceeds ${limitMB}MB limit for ${isImage ? 'images' : 'documents'}`,
    };
  }

  return { valid: true };
}

export function validateUpload(
  file: Buffer,
  contentType: string
): { valid: boolean; error?: string } {
  // Check file type
  const isImage = isValidImageType(contentType);
  const isDocument = isValidDocumentType(contentType);

  if (!isImage && !isDocument) {
    return {
      valid: false,
      error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, PDF, DOC, DOCX',
    };
  }

  // Check file size
  const sizeCheck = validateFileSize(file.length, contentType);
  if (!sizeCheck.valid) {
    return sizeCheck;
  }

  return { valid: true };
}
