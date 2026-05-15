// ============================================================
// LYO - File Upload Utilities
// ============================================================

import multer from 'multer';
import path from 'path';
import { env } from '@/config';
import { AppError } from './apiResponse';

const storage = multer.diskStorage({
  destination: env.UPLOAD_DIR,
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(400, 'INVALID_FILE_TYPE', 'Only images and videos are allowed'));
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(env.MAX_FILE_SIZE),
    files: 4,
  },
  fileFilter,
});

export function getFileUrl(filename: string): string {
  return `/uploads/${filename}`;
}
