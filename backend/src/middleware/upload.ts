import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import fs from 'fs';

// Ensure upload directories exist
const uploadBase = path.resolve(__dirname, '../../', env.UPLOAD_DIR);
const dirs = ['products', 'categories', 'avatars', 'banners'];
dirs.forEach((dir) => {
  const dirPath = path.join(uploadBase, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = (req as any).uploadType || 'products';
    const dest = path.join(uploadBase, type);
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_FILE_SIZE,
  },
});

export function setUploadType(type: string) {
  return (req: any, res: any, next: any) => {
    req.uploadType = type;
    next();
  };
}
