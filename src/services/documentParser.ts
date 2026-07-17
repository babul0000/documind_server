import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

/**
 * Extracts raw text from document buffers based on the MIME type.
 * Supports PDF, DOCX, and text files.
 */
export const parseDocument = async (buffer: Buffer, mimeType: string): Promise<string> => {
  if (mimeType === 'application/pdf') {
    const data = await pdfParse(buffer);
    return data.text || '';
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
