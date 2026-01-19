/**
 * Upload Utility Tests
 *
 * Tests for file upload validation functions.
 */

import { describe, it, expect } from 'vitest';
import {
  FILE_SIZE_LIMITS,
  getFileExtension,
  isValidImageType,
  isValidDocumentType,
  validateFileSize,
  validateUpload,
} from '../../../src/utils/upload.js';

// ============================================
// FILE SIZE LIMITS TESTS
// ============================================

describe('FILE_SIZE_LIMITS', () => {
  it('defines IMAGE limit as 2MB', () => {
    expect(FILE_SIZE_LIMITS.IMAGE).toBe(2 * 1024 * 1024);
  });

  it('defines DOCUMENT limit as 5MB', () => {
    expect(FILE_SIZE_LIMITS.DOCUMENT).toBe(5 * 1024 * 1024);
  });

  it('defines DEFAULT limit as 5MB', () => {
    expect(FILE_SIZE_LIMITS.DEFAULT).toBe(5 * 1024 * 1024);
  });
});

// ============================================
// GET FILE EXTENSION TESTS
// ============================================

describe('getFileExtension', () => {
  it('extracts extension from simple filename', () => {
    expect(getFileExtension('photo.jpg')).toBe('jpg');
  });

  it('extracts extension from filename with multiple dots', () => {
    expect(getFileExtension('my.photo.backup.png')).toBe('png');
  });

  it('returns lowercase extension', () => {
    expect(getFileExtension('document.PDF')).toBe('pdf');
    expect(getFileExtension('image.JPG')).toBe('jpg');
  });

  it('returns filename itself when no dot present', () => {
    // When there's no dot, split('.').pop() returns the full filename
    expect(getFileExtension('filename')).toBe('filename');
  });

  it('handles empty filename', () => {
    expect(getFileExtension('')).toBe('');
  });

  it('handles filename ending with dot', () => {
    expect(getFileExtension('file.')).toBe('');
  });

  it('extracts common image extensions', () => {
    expect(getFileExtension('photo.jpeg')).toBe('jpeg');
    expect(getFileExtension('image.png')).toBe('png');
    expect(getFileExtension('animation.gif')).toBe('gif');
    expect(getFileExtension('modern.webp')).toBe('webp');
  });

  it('extracts common document extensions', () => {
    expect(getFileExtension('report.pdf')).toBe('pdf');
    expect(getFileExtension('letter.doc')).toBe('doc');
    expect(getFileExtension('proposal.docx')).toBe('docx');
  });
});

// ============================================
// IS VALID IMAGE TYPE TESTS
// ============================================

describe('isValidImageType', () => {
  it('accepts image/jpeg', () => {
    expect(isValidImageType('image/jpeg')).toBe(true);
  });

  it('accepts image/png', () => {
    expect(isValidImageType('image/png')).toBe(true);
  });

  it('accepts image/gif', () => {
    expect(isValidImageType('image/gif')).toBe(true);
  });

  it('accepts image/webp', () => {
    expect(isValidImageType('image/webp')).toBe(true);
  });

  it('rejects image/bmp', () => {
    expect(isValidImageType('image/bmp')).toBe(false);
  });

  it('rejects image/svg+xml', () => {
    expect(isValidImageType('image/svg+xml')).toBe(false);
  });

  it('rejects application/pdf', () => {
    expect(isValidImageType('application/pdf')).toBe(false);
  });

  it('rejects text/plain', () => {
    expect(isValidImageType('text/plain')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidImageType('')).toBe(false);
  });
});

// ============================================
// IS VALID DOCUMENT TYPE TESTS
// ============================================

describe('isValidDocumentType', () => {
  it('accepts application/pdf', () => {
    expect(isValidDocumentType('application/pdf')).toBe(true);
  });

  it('accepts application/msword (DOC)', () => {
    expect(isValidDocumentType('application/msword')).toBe(true);
  });

  it('accepts DOCX mime type', () => {
    expect(
      isValidDocumentType(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    ).toBe(true);
  });

  it('rejects application/vnd.ms-excel (XLS)', () => {
    expect(isValidDocumentType('application/vnd.ms-excel')).toBe(false);
  });

  it('rejects text/plain', () => {
    expect(isValidDocumentType('text/plain')).toBe(false);
  });

  it('rejects image/jpeg', () => {
    expect(isValidDocumentType('image/jpeg')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidDocumentType('')).toBe(false);
  });
});

// ============================================
// VALIDATE FILE SIZE TESTS
// ============================================

describe('validateFileSize', () => {
  describe('for images (2MB limit)', () => {
    it('accepts file under 2MB', () => {
      const result = validateFileSize(1 * 1024 * 1024, 'image/jpeg');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('accepts file exactly at 2MB', () => {
      const result = validateFileSize(2 * 1024 * 1024, 'image/png');
      expect(result.valid).toBe(true);
    });

    it('rejects file over 2MB', () => {
      const result = validateFileSize(2 * 1024 * 1024 + 1, 'image/jpeg');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('2MB');
      expect(result.error).toContain('images');
    });

    it('rejects 3MB image', () => {
      const result = validateFileSize(3 * 1024 * 1024, 'image/gif');
      expect(result.valid).toBe(false);
    });
  });

  describe('for documents (5MB limit)', () => {
    it('accepts file under 5MB', () => {
      const result = validateFileSize(3 * 1024 * 1024, 'application/pdf');
      expect(result.valid).toBe(true);
    });

    it('accepts file exactly at 5MB', () => {
      const result = validateFileSize(5 * 1024 * 1024, 'application/pdf');
      expect(result.valid).toBe(true);
    });

    it('rejects file over 5MB', () => {
      const result = validateFileSize(5 * 1024 * 1024 + 1, 'application/pdf');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('5MB');
      expect(result.error).toContain('documents');
    });

    it('rejects 10MB document', () => {
      const result = validateFileSize(10 * 1024 * 1024, 'application/msword');
      expect(result.valid).toBe(false);
    });
  });

  describe('for unknown types', () => {
    it('uses document limit (5MB) for unknown types', () => {
      // Unknown types are not valid images, so they get document limit
      const result = validateFileSize(4 * 1024 * 1024, 'text/plain');
      expect(result.valid).toBe(true);
    });
  });
});

// ============================================
// VALIDATE UPLOAD TESTS
// ============================================

describe('validateUpload', () => {
  describe('valid uploads', () => {
    it('accepts valid JPEG image under 2MB', () => {
      const file = Buffer.alloc(1 * 1024 * 1024);
      const result = validateUpload(file, 'image/jpeg');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('accepts valid PNG image under 2MB', () => {
      const file = Buffer.alloc(500 * 1024);
      const result = validateUpload(file, 'image/png');
      expect(result.valid).toBe(true);
    });

    it('accepts valid PDF under 5MB', () => {
      const file = Buffer.alloc(3 * 1024 * 1024);
      const result = validateUpload(file, 'application/pdf');
      expect(result.valid).toBe(true);
    });

    it('accepts valid DOC under 5MB', () => {
      const file = Buffer.alloc(1 * 1024 * 1024);
      const result = validateUpload(file, 'application/msword');
      expect(result.valid).toBe(true);
    });

    it('accepts valid DOCX under 5MB', () => {
      const file = Buffer.alloc(2 * 1024 * 1024);
      const result = validateUpload(
        file,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      expect(result.valid).toBe(true);
    });
  });

  describe('invalid file types', () => {
    it('rejects text/plain', () => {
      const file = Buffer.alloc(100);
      const result = validateUpload(file, 'text/plain');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    it('rejects application/javascript', () => {
      const file = Buffer.alloc(100);
      const result = validateUpload(file, 'application/javascript');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    it('rejects application/x-executable', () => {
      const file = Buffer.alloc(100);
      const result = validateUpload(file, 'application/x-executable');
      expect(result.valid).toBe(false);
    });

    it('error message lists allowed types', () => {
      const file = Buffer.alloc(100);
      const result = validateUpload(file, 'text/html');
      expect(result.error).toContain('JPEG');
      expect(result.error).toContain('PNG');
      expect(result.error).toContain('PDF');
    });
  });

  describe('file size validation', () => {
    it('rejects image over 2MB', () => {
      const file = Buffer.alloc(3 * 1024 * 1024);
      const result = validateUpload(file, 'image/jpeg');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('2MB');
    });

    it('rejects document over 5MB', () => {
      const file = Buffer.alloc(6 * 1024 * 1024);
      const result = validateUpload(file, 'application/pdf');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('5MB');
    });
  });

  describe('edge cases', () => {
    it('handles empty buffer', () => {
      const file = Buffer.alloc(0);
      const result = validateUpload(file, 'image/jpeg');
      expect(result.valid).toBe(true);
    });

    it('handles 1 byte file', () => {
      const file = Buffer.alloc(1);
      const result = validateUpload(file, 'application/pdf');
      expect(result.valid).toBe(true);
    });
  });
});

// ============================================
// INTEGRATION SCENARIOS
// ============================================

describe('Upload Validation - Real-world Scenarios', () => {
  it('validates profile picture upload (JPEG, 500KB)', () => {
    const file = Buffer.alloc(500 * 1024);
    const result = validateUpload(file, 'image/jpeg');
    expect(result.valid).toBe(true);
  });

  it('validates medical certificate upload (PDF, 1.5MB)', () => {
    const file = Buffer.alloc(1.5 * 1024 * 1024);
    const result = validateUpload(file, 'application/pdf');
    expect(result.valid).toBe(true);
  });

  it('rejects high-res photo upload (JPEG, 5MB)', () => {
    const file = Buffer.alloc(5 * 1024 * 1024);
    const result = validateUpload(file, 'image/jpeg');
    expect(result.valid).toBe(false);
  });

  it('rejects executable disguised as image', () => {
    const file = Buffer.alloc(100);
    // Even if extension is .jpg, we check content type
    const result = validateUpload(file, 'application/x-msdownload');
    expect(result.valid).toBe(false);
  });
});
