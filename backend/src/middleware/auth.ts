import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError, ForbiddenError } from '../utils/appError';
import db from '../config/database';
import { memoryStore } from '../config/mockDb';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email?: string;
    mobile?: string;
    name: string;
    role: 'customer' | 'admin' | 'super_admin' | 'delivery';
    assigned_hub_id?: string;
  };
  adminUser?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export function authenticateCustomer(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) throw new UnauthorizedError('Access token required');

    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    if (decoded.role !== 'customer' && decoded.role !== 'admin' && decoded.role !== 'super_admin') {
      throw new ForbiddenError('Valid user account required');
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      mobile: decoded.mobile,
      name: decoded.name,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expired'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
    } else {
      next(error);
    }
  }
}

export function authenticateAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) throw new UnauthorizedError('Access token required');

    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    if (decoded.role !== 'admin' && decoded.role !== 'super_admin') {
      throw new ForbiddenError('Admin access only');
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
    };
    req.adminUser = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expired'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
    } else {
      next(error);
    }
  }
}

export async function authenticateDeliveryPerson(req: AuthRequest, res: Response, next: NextFunction) {
  return res.status(410).json({
    success: false,
    statusCode: 410,
    code: 'DELIVERY_PARTNER_ENDPOINT_DISCONTINUED',
    message: 'Delivery partner authentication has been discontinued. Fresh Vegetables Organic operates on a direct admin-managed delivery model.',
    timestamp: new Date().toISOString(),
  });
}

export async function authenticateDeliveryOrAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) throw new UnauthorizedError('Authentication token required');

    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    if (decoded.role === 'admin' || decoded.role === 'super_admin') {
      req.user = {
        id: decoded.id,
        email: decoded.email,
        mobile: decoded.mobile,
        name: decoded.name,
        role: decoded.role,
      };
      return next();
    }

    // Any non-admin delivery partner token is rejected as discontinued
    return res.status(410).json({
      success: false,
      statusCode: 410,
      code: 'DELIVERY_PARTNER_ENDPOINT_DISCONTINUED',
      message: 'Delivery partner access has been discontinued. Deliveries are direct admin-managed.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expired'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
    } else {
      next(error);
    }
  }
}

export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) return next();

    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      mobile: decoded.mobile,
      name: decoded.name,
      role: decoded.role,
    };

    next();
  } catch {
    next();
  }
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

export function generateTokens(user: { id: string; email?: string; mobile?: string; name: string; role: string }) {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, mobile: user.mobile, name: user.name, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as any }
  );

  const refreshToken = jwt.sign(
    { id: user.id, role: user.role },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any }
  );

  return { accessToken, refreshToken };
}
