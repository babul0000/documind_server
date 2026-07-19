import mammoth = require('mammoth');

// Polyfill browser globals required by pdf-parse (pdfjs-dist) in Node.js server environments
if (typeof (global as any).DOMMatrix === 'undefined') {
  (global as any).DOMMatrix = class DOMMatrix {};
}
if (typeof (global as any).ImageData === 'undefined') {
  (global as any).ImageData = class ImageData {};
}
if (typeof (global as any).Path2D === 'undefined') {
  (global as any).Path2D = class Path2D {};
}

// Load pdf-parse using direct CommonJS require to avoid TypeScript module resolution warnings
const { PDFParse } = require('pdf-parse') as any;
const { getPath } = require('pdf-parse/worker') as any;
PDFParse.setWorker(getPath());

/**
 * Extracts raw text from document buffers based on the MIME type.
 * Supports PDF, DOCX, and text files.
 * Custom built for pdf-parse version 2.4.5 class-based API.
 */
export const parseDocument = async (buffer: Buffer, mimeType: string): Promise<string> => {
  if (mimeType === 'application/pdf') {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text || '';
    } finally {
      // Always destroy parser to release underlying PDFJS resources
      await parser.destroy().catch(() => {});
    }
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } else if (mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType === 'application/octet-stream') {
    return buffer.toString('utf-8');
  } else {
    // Fallback: try reading as text
    return buffer.toString('utf-8');
  }
};
