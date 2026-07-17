import multer from 'multer';

// Use memory storage to avoid writing local temp files to disk
const storage = multer.memoryStorage();

/**
 * Configure multer upload constraints:
 * - Accept: PDF, DOCX, and TXT files
 * - Maximum file size: 10MB
 */
export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, and TXT documents are allowed.') as any, false);
    }
  },
});
