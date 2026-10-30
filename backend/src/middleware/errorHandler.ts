import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError';
import { env } from '../config/env';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Multer & multipart errors
  if (
    err.message === 'File too large' ||
    (err as any).code === 'LIMIT_FILE_SIZE' ||
    (err as any).name === 'MulterError' ||
    err.message?.includes('Boundary not found')
  ) {
    const isSize = err.message === 'File too large' || (err as any).code === 'LIMIT_FILE_SIZE';
    return res.status(400).json({
      success: false,
      message: isSize
        ? 'File size exceeds the maximum limit (max 25MB). Please upload a smaller or compressed image.'
        : err.message || 'Image upload failed',
    });
  }

  // PostgreSQL unique violation
  if ((err as any).code === '23505') {
    return res.status(409).json({
      success: false,
      message: 'A record with this value already exists',
    });
  }

  // PostgreSQL foreign key violation
  if ((err as any).code === '23503') {
    return res.status(400).json({
      success: false,
      message: 'Referenced record does not exist',
    });
  }

  console.error('Unhandled error:', err);

  return res.status(500).json({
    success: false,
    message: env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
}
