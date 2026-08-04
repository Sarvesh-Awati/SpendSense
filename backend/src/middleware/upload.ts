import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import { BadRequestError } from '../errors/AppError';

/**
 * Multer middleware configured for receipt image uploads.
 * Uses memory storage to avoid writing temp files to disk.
 * Accepted formats: jpg, jpeg, png, webp
 * Max file size: 5 MB
 */

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const storage = multer.memoryStorage();

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestError('Unsupported file type. Accepted formats: JPG, JPEG, PNG, WEBP'));
  }
};

export const receiptUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

export default receiptUpload;
