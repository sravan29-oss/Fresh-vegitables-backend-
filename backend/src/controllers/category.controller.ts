import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import db from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess, sendPaginated } from '../utils/apiResponse';
import { AppError, NotFoundError } from '../utils/appError';
import { generateSlug } from '../utils/helpers';
import cache from '../services/cache.service';

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

    let image = null;
    if (req.file) {
      try {
        if (fs.existsSync(req.file.path)) {
          const buf = fs.readFileSync(req.file.path);
          image = `data:${req.file.mimetype};base64,${buf.toString('base64')}`;
          fs.unlink(req.file.path, () => {});
        } else {
          image = `/uploads/categories/${req.file.filename}`;
        }
      } catch {
        image = `/uploads/categories/${req.file.filename}`;
      }
    }
    if (!image && (req.body.image || req.body.image_url)) {
      image = req.body.image || req.body.image_url;
    }

    const result = await db.query(
      `INSERT INTO categories (name, slug, description, image, status, display_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, slug, description || null, image, status, display_order]
    );

    cache.invalidate('cms:homepage');
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
      let imgData = `/uploads/categories/${req.file.filename}`;
      try {
        if (fs.existsSync(req.file.path)) {
          const buf = fs.readFileSync(req.file.path);
          imgData = `data:${req.file.mimetype};base64,${buf.toString('base64')}`;
          fs.unlink(req.file.path, () => {});
        }
      } catch {}
      fields.push(`image = $${idx++}`);
      values.push(imgData);
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

    cache.invalidate('cms:homepage');
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

    // Unlink any products referencing this category so products are preserved safely
    await db.query('UPDATE products SET category_id = NULL WHERE category_id = $1', [id]);

    // Permanently delete category from database
    await db.query('DELETE FROM categories WHERE id = $1', [id]);

    cache.invalidate('cms:homepage');
    sendSuccess(res, 'Category deleted permanently from database');
  } catch (error) {
    next(error);
  }
}
