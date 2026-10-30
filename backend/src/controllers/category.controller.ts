import { Request, Response, NextFunction } from 'express';
import db from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess, sendPaginated } from '../utils/apiResponse';
import { AppError, NotFoundError } from '../utils/appError';
import { generateSlug } from '../utils/helpers';

// ===================== PUBLIC =====================

export async function getCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await db.query(
      `SELECT id, name, slug, description, image, status, display_order
       FROM categories WHERE status = 'active'
       ORDER BY display_order ASC, name ASC`
    );
    sendSuccess(res, 'Categories fetched successfully', result.rows);
  } catch (error) {
    next(error);
  }
}

export async function getCategoryBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    const { slug } = req.params;
    const result = await db.query(
      'SELECT id, name, slug, description, image, status, display_order FROM categories WHERE slug = $1',
      [slug]
    );
    if (result.rows.length === 0) throw new NotFoundError('Category not found');
    sendSuccess(res, 'Category fetched', result.rows[0]);
  } catch (error) {
    next(error);
  }
}

// ===================== ADMIN =====================

export async function getAllCategories(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await db.query(
      `SELECT c.*, 
       (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id)::int as product_count
       FROM categories c ORDER BY c.display_order ASC, c.name ASC`
    );
    sendSuccess(res, 'All categories fetched', result.rows);
  } catch (error) {
    next(error);
  }
}

export async function createCategory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { name, description, status, display_order } = req.body;
    const slug = generateSlug(name);

    let image = req.file ? `/uploads/categories/${req.file.filename}` : null;
    if (!image && (req.body.image || req.body.image_url)) {
      image = req.body.image || req.body.image_url;
    }

    const result = await db.query(
      `INSERT INTO categories (name, slug, description, image, status, display_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, slug, description || null, image, status, display_order]
    );

    sendSuccess(res, 'Category created successfully', result.rows[0], 201);
  } catch (error) {
    next(error);
  }
}

export async function updateCategory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { name, description, status, display_order } = req.body;

    // Check exists
    const existing = await db.query('SELECT * FROM categories WHERE id = $1', [id]);
    if (existing.rows.length === 0) throw new NotFoundError('Category not found');

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (name) {
      fields.push(`name = $${idx++}`, `slug = $${idx++}`);
      values.push(name, generateSlug(name));
    }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
    if (status) { fields.push(`status = $${idx++}`); values.push(status); }
    if (display_order !== undefined) { fields.push(`display_order = $${idx++}`); values.push(display_order); }

    if (req.file) {
      fields.push(`image = $${idx++}`);
      values.push(`/uploads/categories/${req.file.filename}`);
    } else if (req.body.image !== undefined) {
      fields.push(`image = $${idx++}`);
      values.push(req.body.image || null);
    } else if (req.body.image_url !== undefined) {
      fields.push(`image = $${idx++}`);
      values.push(req.body.image_url || null);
    }

    if (fields.length === 0) throw new AppError('No fields to update', 400);

    fields.push('updated_at = NOW()');
    values.push(id);
    const result = await db.query(
      `UPDATE categories SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    sendSuccess(res, 'Category updated successfully', result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function deleteCategory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    
    const existing = await db.query('SELECT * FROM categories WHERE id = $1', [id]);
    if (existing.rows.length === 0) throw new NotFoundError('Category not found');

    // Soft delete: set status to inactive
    await db.query("UPDATE categories SET status = 'inactive' WHERE id = $1", [id]);

    sendSuccess(res, 'Category deactivated successfully');
  } catch (error) {
    next(error);
  }
}
