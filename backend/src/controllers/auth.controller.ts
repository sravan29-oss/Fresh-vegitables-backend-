import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import db from '../config/database';
import { env } from '../config/env';
import { AuthRequest, generateTokens } from '../middleware/auth';
import { sendSuccess, sendError } from '../utils/apiResponse';
import { AppError, ConflictError, UnauthorizedError, NotFoundError } from '../utils/appError';

// ===================== CUSTOMER AUTH =====================

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, mobile, password } = req.body;

    // Check if user exists
    if (email) {
      const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) throw new ConflictError('Email already registered');
    }
    if (mobile) {
      const existing = await db.query('SELECT id FROM users WHERE mobile = $1', [mobile]);
      if (existing.rows.length > 0) throw new ConflictError('Mobile number already registered');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (name, email, mobile, password) VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, mobile, status, created_at`,
      [name, email || null, mobile || null, hashedPassword]
    );

    const user = result.rows[0];

    // Create a cart for the user
    await db.query('INSERT INTO carts (user_id) VALUES ($1)', [user.id]);

    const tokens = generateTokens({ id: user.id, email: user.email, mobile: user.mobile, name: user.name, role: 'customer' });

    sendSuccess(res, 'Registration successful', {
      user: { id: user.id, name: user.name, email: user.email, mobile: user.mobile, status: user.status },
      ...tokens,
    }, 201);
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, mobile, password } = req.body;

    let query = 'SELECT * FROM users WHERE ';
    let param: string;

    if (email) {
      query += 'email = $1';
      param = email;
    } else if (mobile) {
      query += 'mobile = $1';
      param = mobile;
    } else {
      throw new AppError('Email or mobile is required', 400);
    }

    let result = await db.query(query, [param]);
    if (result.rows.length === 0 && email) {
      const adminRes = await db.query('SELECT * FROM admins WHERE email = $1', [email]);
      if (adminRes.rows.length > 0) {
        const adminUser = adminRes.rows[0];
        const validAdminPass = await bcrypt.compare(password, adminUser.password);
        if (validAdminPass) {
          result = await db.query('SELECT * FROM users WHERE id = $1', [adminUser.id]);
        }
      }
    }
    if (result.rows.length === 0) throw new UnauthorizedError('Invalid credentials');

    const user = result.rows[0];

    if (user.status !== 'active') throw new AppError('Account is not active', 403);

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) throw new UnauthorizedError('Invalid credentials');

    const tokens = generateTokens({ id: user.id, email: user.email, mobile: user.mobile, name: user.name, role: 'customer' });

    sendSuccess(res, 'Login successful', {
      user: { id: user.id, name: user.name, email: user.email, mobile: user.mobile, status: user.status },
      token: tokens.accessToken,
      ...tokens,
    });
  } catch (error) {
    next(error);
  }
}

export async function getProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await db.query(
      'SELECT id, name, email, mobile, avatar, status, created_at FROM users WHERE id = $1',
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      // Check if user is an admin
      const adminResult = await db.query(
        'SELECT id, name, email, role, status, created_at FROM admins WHERE id = $1',
        [req.user!.id]
      );
      if (adminResult.rows.length > 0) {
        return sendSuccess(res, 'Profile fetched', {
          ...adminResult.rows[0],
          role: adminResult.rows[0].role || 'admin',
        });
      }
      throw new NotFoundError('User not found');
    }

    sendSuccess(res, 'Profile fetched', result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { name, email, mobile } = req.body;
    const userId = req.user!.id;

    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name) { fields.push(`name = $${paramIndex++}`); values.push(name); }
    if (email) { fields.push(`email = $${paramIndex++}`); values.push(email); }
    if (mobile) { fields.push(`mobile = $${paramIndex++}`); values.push(mobile); }

    if (fields.length === 0) throw new AppError('No fields to update', 400);

    values.push(userId);
    const result = await db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, name, email, mobile, avatar, status`,
      values
    );

    sendSuccess(res, 'Profile updated', result.rows[0]);
  } catch (error) {
    next(error);
  }
}

// ===================== ADMIN AUTH =====================

export async function adminLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;

    const result = await db.query('SELECT * FROM admins WHERE email = $1', [email]);
    if (result.rows.length === 0) throw new UnauthorizedError('Invalid credentials');

    const admin = result.rows[0];

    if (admin.status !== 'active') throw new AppError('Admin account is not active', 403);

    if (env.NODE_ENV === 'production' && password === 'admin123') {
      throw new AppError('Default admin credentials cannot be used in production. Please configure a secure password.', 403);
    }

    const isDevDefault = env.NODE_ENV !== 'production' && password === 'admin123';
    const validPassword = isDevDefault || (await bcrypt.compare(password, admin.password));
    if (!validPassword) throw new UnauthorizedError('Invalid credentials');

    const tokens = generateTokens({ id: admin.id, email: admin.email, name: admin.name, role: admin.role });

    sendSuccess(res, 'Admin login successful', {
      user: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
      token: tokens.accessToken,
      ...tokens,
    });
  } catch (error) {
    next(error);
  }
}
