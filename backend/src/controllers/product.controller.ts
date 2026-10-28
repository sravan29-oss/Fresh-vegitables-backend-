import { Request, Response, NextFunction } from 'express';
import db from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess, sendPaginated } from '../utils/apiResponse';
import { AppError, NotFoundError } from '../utils/appError';
import { generateSlug, parsePaginationParams, calculateDiscount, getStockStatus } from '../utils/helpers';

// ===================== PUBLIC ROUTES =====================

export async function getProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit, offset } = parsePaginationParams(req.query);
    const { search, category, sort, minPrice, maxPrice, featured, best_seller, in_stock } = req.query as any;

    let whereClause = "WHERE p.status = 'active'";
    const params: any[] = [];
    let paramIdx = 1;

    if (search) {
      whereClause += ` AND (p.name ILIKE $${paramIdx} OR p.description ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (category) {
      whereClause += ` AND (c.slug = $${paramIdx} OR c.id::text = $${paramIdx})`;
      params.push(category);
      paramIdx++;
    }

    if (minPrice) {
      whereClause += ` AND p.selling_price >= $${paramIdx}`;
      params.push(parseFloat(minPrice));
      paramIdx++;
    }

    if (maxPrice) {
      whereClause += ` AND p.selling_price <= $${paramIdx}`;
      params.push(parseFloat(maxPrice));
      paramIdx++;
    }

    if (featured === 'true') {
      whereClause += ' AND p.featured = true';
    }

    if (best_seller === 'true') {
      whereClause += ' AND p.best_seller = true';
    }

    if (in_stock === 'true') {
      whereClause += ' AND p.stock_quantity > 0';
    }

    let orderClause = 'ORDER BY ';
    switch (sort) {
      case 'price_asc': orderClause += 'p.selling_price ASC'; break;
      case 'price_desc': orderClause += 'p.selling_price DESC'; break;
      case 'newest': orderClause += 'p.created_at DESC'; break;
      case 'discount': orderClause += '(p.mrp - p.selling_price) DESC'; break;
      case 'name_asc': orderClause += 'p.name ASC'; break;
      case 'name_desc': orderClause += 'p.name DESC'; break;
      case 'popular':
      default: orderClause += 'p.best_seller DESC, p.featured DESC, p.created_at DESC'; break;
    }

    // Count total
    const countQuery = `SELECT COUNT(*)::int as total FROM products p LEFT JOIN categories c ON p.category_id = c.id ${whereClause}`;
    const countResult = await db.query(countQuery, params);
    const total = countResult.rows && countResult.rows[0] ? countResult.rows[0].total : 0;

    // Get products
    const dataParams = [...params, limit, offset];
    const dataQuery = `
      SELECT p.id, p.name, p.slug, p.category_id, p.description, p.images, p.unit,
             p.mrp, p.selling_price, p.stock_quantity, p.minimum_stock,
             p.status, p.featured, p.best_seller, p.created_at,
             c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereClause}
      ${orderClause}
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;

    const result = await db.query(dataQuery, dataParams);

    // Attach active variants if any
    let allVariants: any[] = [];
    try {
      const vRes = await db.query("SELECT * FROM product_variants WHERE status = 'active' ORDER BY selling_price ASC");
      allVariants = vRes.rows || [];
    } catch (_) {}

    const products = result.rows.map((p) => ({
      ...p,
      discount: calculateDiscount(parseFloat(p.mrp), parseFloat(p.selling_price)),
      stock_status: getStockStatus(p.stock_quantity, p.minimum_stock),
      variants: allVariants.filter((v) => v.product_id === p.id),
    }));

    sendPaginated(res, 'Products fetched successfully', products, { page, limit, total });
  } catch (error) {
    next(error);
  }
}

export async function getProductBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    const { slug } = req.params;

    const result = await db.query(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.slug = $1`,
      [slug]
    );

    if (result.rows.length === 0) throw new NotFoundError('Product not found');

    const product = result.rows[0];

    // Get variants
    const variants = await db.query(
      `SELECT * FROM product_variants WHERE product_id = $1 AND status = 'active' ORDER BY selling_price ASC`,
      [product.id]
    );

    // Get related products
    const related = await db.query(
      `SELECT p.id, p.name, p.slug, p.images, p.unit, p.mrp, p.selling_price,
              p.stock_quantity, p.minimum_stock
       FROM products p
       WHERE p.category_id = $1 AND p.id != $2 AND p.status = 'active'
       LIMIT 8`,
      [product.category_id, product.id]
    );

    sendSuccess(res, 'Product fetched', {
      ...product,
      discount: calculateDiscount(parseFloat(product.mrp), parseFloat(product.selling_price)),
      stock_status: getStockStatus(product.stock_quantity, product.minimum_stock),
      variants: variants.rows,
      related_products: related.rows.map((p) => ({
        ...p,
        discount: calculateDiscount(parseFloat(p.mrp), parseFloat(p.selling_price)),
        stock_status: getStockStatus(p.stock_quantity, p.minimum_stock),
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function getProductById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) throw new NotFoundError('Product not found');

    const product = result.rows[0];

    const variants = await db.query(
      `SELECT * FROM product_variants WHERE product_id = $1 ORDER BY selling_price ASC`,
      [product.id]
    );

    sendSuccess(res, 'Product fetched', {
      ...product,
      discount: calculateDiscount(parseFloat(product.mrp), parseFloat(product.selling_price)),
      stock_status: getStockStatus(product.stock_quantity, product.minimum_stock),
      variants: variants.rows,
    });
  } catch (error) {
    next(error);
  }
}

// ===================== ADMIN =====================

export async function adminGetProducts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, offset } = parsePaginationParams(req.query);
    const { search, category, status } = req.query as any;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    if (search) {
      whereClause += ` AND (p.name ILIKE $${paramIdx} OR p.slug ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (category) {
      whereClause += ` AND (c.slug = $${paramIdx} OR p.category_id::text = $${paramIdx})`;
      params.push(category);
      paramIdx++;
    }

    if (status) {
      whereClause += ` AND p.status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }

    const countResult = await db.query(
      `SELECT COUNT(*)::int as total FROM products p LEFT JOIN categories c ON p.category_id = c.id ${whereClause}`,
      params
    );

    const dataParams = [...params, limit, offset];
    const result = await db.query(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      dataParams
    );

    const products = result.rows.map((p) => ({
      ...p,
      discount: calculateDiscount(parseFloat(p.mrp), parseFloat(p.selling_price)),
      stock_status: getStockStatus(p.stock_quantity, p.minimum_stock),
    }));

    sendPaginated(res, 'Products fetched', products, { page, limit, total: countResult.rows[0].total });
  } catch (error) {
    next(error);
  }
}

export async function createProduct(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { name, category_id, description, unit, mrp, selling_price, purchase_price,
            stock_quantity, minimum_stock, status, featured, best_seller } = req.body;

    const slug = generateSlug(name);

    // Handle uploaded images & image URLs
    const images: string[] = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      req.files.forEach((file: Express.Multer.File) => {
        images.push(`/uploads/products/${file.filename}`);
      });
    }

    if (req.body.image_url && typeof req.body.image_url === 'string' && req.body.image_url.trim()) {
      images.push(req.body.image_url.trim());
    }

    if (req.body.images) {
      if (Array.isArray(req.body.images)) {
        images.push(...req.body.images.filter(Boolean));
      } else if (typeof req.body.images === 'string') {
        try {
          const parsed = JSON.parse(req.body.images);
          if (Array.isArray(parsed)) images.push(...parsed);
          else if (req.body.images.trim()) images.push(req.body.images.trim());
        } catch {
          if (req.body.images.trim()) images.push(req.body.images.trim());
        }
      }
    }

    // Smart fallback image based on vegetable name if none provided
    if (images.length === 0) {
      const lower = (name || '').toLowerCase();
      const vegMap: Record<string, string> = {
        tomato: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500&auto=format&fit=crop',
        tamato: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500&auto=format&fit=crop',
        potato: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&auto=format&fit=crop',
        onion: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=500&auto=format&fit=crop',
        carrot: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=500&auto=format&fit=crop',
        spinach: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=500&auto=format&fit=crop',
        capsicum: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=500&auto=format&fit=crop',
        cucumber: 'https://images.unsplash.com/photo-1604977042946-1eecc30f269e?w=500&auto=format&fit=crop',
        cauliflower: 'https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?w=500&auto=format&fit=crop',
        cabbage: 'https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=500&auto=format&fit=crop',
        brinjal: 'https://images.unsplash.com/photo-1659261054238-eb341d3e86c0?w=500&auto=format&fit=crop',
        eggplant: 'https://images.unsplash.com/photo-1659261054238-eb341d3e86c0?w=500&auto=format&fit=crop',
        garlic: 'https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?w=500&auto=format&fit=crop',
        ginger: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=500&auto=format&fit=crop',
      };
      let match = '';
      for (const [k, v] of Object.entries(vegMap)) {
        if (lower.includes(k)) {
          match = v;
          break;
        }
      }
      images.push(match || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop');
    }

    const result = await db.query(
      `INSERT INTO products (name, slug, category_id, description, images, unit, mrp, selling_price,
       purchase_price, stock_quantity, minimum_stock, status, featured, best_seller)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [name, slug, category_id || null, description || null, images, unit, mrp, selling_price,
       purchase_price, stock_quantity, minimum_stock, status, featured, best_seller]
    );

    // Create variants if provided
    let variants: string | any[] = [];
    try {
      if (req.body.variants) {
        const parsedVariants = typeof req.body.variants === 'string' ? JSON.parse(req.body.variants) : req.body.variants;
        if (Array.isArray(parsedVariants) && parsedVariants.length > 0) {
          for (const v of parsedVariants) {
            const vResult = await db.query(
              `INSERT INTO product_variants (product_id, name, unit, mrp, selling_price, stock_quantity, status)
               VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
              [result.rows[0].id, v.name, v.unit, v.mrp, v.selling_price, v.stock_quantity || 0, v.status || 'active']
            );
            variants.push(vResult.rows[0]);
          }
        }
      }
    } catch (e) { /* variants parsing is optional */ }

    sendSuccess(res, 'Product created successfully', { ...result.rows[0], variants }, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateProduct(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const existing = await db.query('SELECT * FROM products WHERE id = $1', [id]);
    if (existing.rows.length === 0) throw new NotFoundError('Product not found');

    const { name, category_id, description, unit, mrp, selling_price, purchase_price,
            stock_quantity, minimum_stock, status, featured, best_seller } = req.body;

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (name) { fields.push(`name = $${idx++}`, `slug = $${idx++}`); values.push(name, generateSlug(name)); }
    if (category_id !== undefined) { fields.push(`category_id = $${idx++}`); values.push(category_id || null); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
    if (unit) { fields.push(`unit = $${idx++}`); values.push(unit); }
    if (mrp !== undefined) { fields.push(`mrp = $${idx++}`); values.push(mrp); }
    if (selling_price !== undefined) { fields.push(`selling_price = $${idx++}`); values.push(selling_price); }
    if (purchase_price !== undefined) { fields.push(`purchase_price = $${idx++}`); values.push(purchase_price); }
    if (stock_quantity !== undefined) { fields.push(`stock_quantity = $${idx++}`); values.push(stock_quantity); }
    if (minimum_stock !== undefined) { fields.push(`minimum_stock = $${idx++}`); values.push(minimum_stock); }
    if (status) { fields.push(`status = $${idx++}`); values.push(status); }
    if (featured !== undefined) { fields.push(`featured = $${idx++}`); values.push(featured); }
    if (best_seller !== undefined) { fields.push(`best_seller = $${idx++}`); values.push(best_seller); }

    // Handle uploaded images and image URLs
    let newImages: string[] = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      newImages = req.files.map((file: Express.Multer.File) => `/uploads/products/${file.filename}`);
    } else if (req.body.image_url && typeof req.body.image_url === 'string' && req.body.image_url.trim()) {
      newImages = [req.body.image_url.trim()];
    } else if (req.body.images) {
      if (Array.isArray(req.body.images)) {
        newImages = req.body.images.filter(Boolean);
      } else if (typeof req.body.images === 'string') {
        try {
          const parsed = JSON.parse(req.body.images);
          if (Array.isArray(parsed)) newImages = parsed;
          else if (req.body.images.trim()) newImages = [req.body.images.trim()];
        } catch {
          if (req.body.images.trim()) newImages = [req.body.images.trim()];
        }
      }
    }

    if (newImages.length > 0) {
      fields.push(`images = $${idx++}`);
      values.push(newImages);
    }

    if (fields.length === 0) throw new AppError('No fields to update', 400);

    values.push(id);
    const result = await db.query(
      `UPDATE products SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    // Update variants if provided
    try {
      if (req.body.variants) {
        const parsedVariants = typeof req.body.variants === 'string' ? JSON.parse(req.body.variants) : req.body.variants;
        if (Array.isArray(parsedVariants)) {
          // Delete old variants and re-create
          await db.query('DELETE FROM product_variants WHERE product_id = $1', [id]);
          for (const v of parsedVariants) {
            await db.query(
              `INSERT INTO product_variants (product_id, name, unit, mrp, selling_price, stock_quantity, status)
               VALUES ($1,$2,$3,$4,$5,$6,$7)`,
              [id, v.name, v.unit, v.mrp, v.selling_price, v.stock_quantity || 0, v.status || 'active']
            );
          }
        }
      }
    } catch (e) { /* variants parsing is optional */ }

    // Fetch updated product with variants
    const variants = await db.query('SELECT * FROM product_variants WHERE product_id = $1 ORDER BY selling_price', [id]);

    sendSuccess(res, 'Product updated successfully', { ...result.rows[0], variants: variants.rows });
  } catch (error) {
    next(error);
  }
}

export async function deleteProduct(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const existing = await db.query('SELECT * FROM products WHERE id = $1', [id]);
    if (existing.rows.length === 0) throw new NotFoundError('Product not found');

    // Soft delete
    await db.query("UPDATE products SET status = 'inactive' WHERE id = $1", [id]);

    sendSuccess(res, 'Product deactivated successfully');
  } catch (error) {
    next(error);
  }
}

export async function restoreAdminProducts(req: Request, res: Response, next: NextFunction) {
  try {
    // 1. Insert category Fresh
    await db.query(`
      INSERT INTO categories (id, name, slug, description, image, status, display_order)
      VALUES ('8e8bbc30-1625-4f6b-8b5f-6c33ae7501cd', 'Fresh', 'fresh', 'Farm-fresh organic vegetables delivered to your doorstep', '/uploads/categories/fresh-vegetables.jpg', 'active', 1)
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        status = 'active',
        display_order = 1;
    `);

    // 2. Insert 6 products
    await db.query(`
      INSERT INTO products (id, name, slug, category_id, description, images, unit, mrp, selling_price, stock_quantity, minimum_stock, status, featured, best_seller)
      VALUES
      ('faf5d663-3868-40a9-8933-ed0560ec4c53', 'Tomato', 'tomato', '8e8bbc30-1625-4f6b-8b5f-6c33ae7501cd', 'Fresh From Market When order reach', ARRAY['/uploads/products/e617cc8b-b81d-4b2c-b622-8c9cc407fd85.webp'], '500grms', 28.00, 25.00, 41, 5, 'active', true, true),
      ('344f868a-89e0-425c-aeef-8d34533b29f0', 'Lady Finger', 'lady-finger', '8e8bbc30-1625-4f6b-8b5f-6c33ae7501cd', 'Fresh organic tender lady fingers (bhindi)', ARRAY['/uploads/products/3fde6e03-c8c8-495d-9698-94fe1cae6f37.jpg'], '50Grms', 81.00, 71.00, 40, 5, 'active', true, true),
      ('1a9b98b2-0629-4cac-9318-c2c65107989d', 'Fresh Onion', 'fresh-onion', '8e8bbc30-1625-4f6b-8b5f-6c33ae7501cd', 'Locally grown crisp and flavorful onions', ARRAY['/uploads/products/0d811c27-2289-4ab1-98a9-e244529e039c.jpg'], '1Kg', 50.00, 50.00, 40, 5, 'active', true, false),
      ('52bf6893-9533-495d-b1db-6621b568f666', 'Organically Grown Coriander Leaves', 'organically-grown-coriander-leaves', '8e8bbc30-1625-4f6b-8b5f-6c33ae7501cd', 'Fresh and aromatic organically grown coriander', ARRAY['/uploads/products/45d16aa7-365d-425f-8180-dc1237bbfe20.jpg'], '100grms', 45.00, 30.00, 40, 5, 'active', true, false),
      ('378716d3-0609-4c9f-90b1-b5dc2eb6dbc6', 'Potato', 'potato', '8e8bbc30-1625-4f6b-8b5f-6c33ae7501cd', 'Farm-fresh premium quality organic potatoes', ARRAY['/uploads/products/57ba83f7-4556-49cb-9bdf-ff77b63be99a.jpg'], '1kg', 60.00, 55.00, 40, 5, 'active', true, false),
      ('7720acc5-22d6-4cbb-be3d-334d823dccca', 'Carrot Local', 'carrot-local', '8e8bbc30-1625-4f6b-8b5f-6c33ae7501cd', 'Sweet and crunchy locally harvested carrots', ARRAY['/uploads/products/5a3e8a3b-9bdf-4350-b461-c481dc76e502.jpg'], '250grms', 52.00, 30.00, 40, 5, 'active', true, false)
      ON CONFLICT (slug) DO UPDATE SET
        category_id = EXCLUDED.category_id,
        selling_price = EXCLUDED.selling_price,
        mrp = EXCLUDED.mrp,
        stock_quantity = EXCLUDED.stock_quantity,
        unit = EXCLUDED.unit,
        images = EXCLUDED.images,
        description = EXCLUDED.description,
        status = 'active';
    `);

    // 3. Upsert admin
    const sravanHash = '$2b$10$fN7C1aZpT7qefZRzrnjWouSTAmq/uJyNKfXcVIcUjXWYt7D4f.uY6';
    await db.query(`
      INSERT INTO admins (name, email, password, role, status)
      VALUES ('Sravan Kumar', 'naredlasravankumar29@gmail.com', $1, 'super_admin', 'active')
      ON CONFLICT (email) 
      DO UPDATE SET password = $1, role = 'super_admin', status = 'active';
    `, [sravanHash]);

    const prods = await db.query('SELECT * FROM products');
    const cats = await db.query('SELECT * FROM categories');

    return res.json({
      success: true,
      message: 'Category "Fresh" and 6 products restored and synced successfully',
      categoriesCount: cats.rows.length,
      productsCount: prods.rows.length,
      products: prods.rows
    });
  } catch (err: any) {
    next(err);
  }
}

