import { Response } from 'express';

interface ApiResponseOptions {
  success: boolean;
  message: string;
  data?: any;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  errors?: any;
}

export function sendResponse(res: Response, statusCode: number, options: ApiResponseOptions) {
  const response: any = {
    success: options.success,
    message: options.message,
  };

  if (options.data !== undefined) {
    response.data = options.data;
  }

  if (options.pagination) {
    response.pagination = options.pagination;
  }

  if (options.errors) {
    response.errors = options.errors;
  }

  return res.status(statusCode).json(response);
}

export function sendSuccess(res: Response, message: string, data?: any, statusCode: number = 200) {
  return sendResponse(res, statusCode, { success: true, message, data });
}

export function sendPaginated(
  res: Response,
  message: string,
  data: any,
  pagination: { page: number; limit: number; total: number }
) {
  return sendResponse(res, 200, {
    success: true,
    message,
    data,
    pagination: {
      ...pagination,
      totalPages: Math.ceil(pagination.total / pagination.limit),
    },
  });
}

export function sendError(res: Response, message: string, statusCode: number = 500, errors?: any) {
  return sendResponse(res, statusCode, { success: false, message, errors });
}
