import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import db from '../config/database';
import { memoryStore } from '../config/mockDb';
import { sendSuccess } from '../utils/apiResponse';
import cache from '../services/cache.service';
import { logAuditEvent } from '../services/audit.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Sanitizes input text against Cross-Site Scripting (XSS) and unauthorized HTML/script injection
 */
export function sanitizeText(input?: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/onerror\s*=\s*["']?[^"'>]+/gi, '')
    .replace(/onload\s*=\s*["']?[^"'>]+/gi, '')
    .replace(/onclick\s*=\s*["']?[^"'>]+/gi, '')
    .replace(/javascript\s*:/gi, '')
    .trim();
}

/**
 * Validates that an image URL is safe and valid
 */
export function isValidImageUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('data:image/')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validates link destination URL
 */
export function isValidLinkUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Public Customer Homepage Endpoint
 * Returns only active, scheduled, and validated database catalog content
 */
export async function getHomepageData(req: Request, res: Response, next: NextFunction) {
  try {
    const cached = cache.get('cms:homepage');
    if (cached) {
      return sendSuccess(res, 'Homepage CMS data (cached)', cached);
    }

    let rawActive: any[] = [];
    let banners: any[] = [];

    try {
      const sectionsRes = await db.query(
        `SELECT * FROM homepage_sections WHERE status = 'active' ORDER BY display_order ASC`
      );
      const bannersRes = await db.query(
        `SELECT * FROM homepage_banners WHERE status = 'active' ORDER BY display_order ASC`
      );
      rawActive = sectionsRes.rows || [];
      banners = bannersRes.rows || [];
    } catch {
      rawActive = ((memoryStore as any).homepage_sections || []).filter((s: any) => s.status === 'active');
      banners = ((memoryStore as any).homepage_banners || []).filter((b: any) => b.status === 'active');
    }

    const now = new Date();
    // Strictly filter scheduled content
    const filteredActive = rawActive.filter((sec: any) => {
      if (sec.type === 'hero_banner') return false; // Default hero banner removed
      if (sec.start_date && new Date(sec.start_date) > now) return false;
      if (sec.end_date && new Date(sec.end_date) < now) return false;
      return true;
    });

    const activeBanners = banners.filter((b: any) => {
      if (b.status !== 'active') return false;
      if (b.start_date && new Date(b.start_date) > now) return false;
      if (b.end_date && new Date(b.end_date) < now) return false;
      return true;
    });

    const activeSections = filteredActive.length > 0 ? filteredActive : [
      { id: 'sec-cats', type: 'categories', title: 'Shop by Harvest Category', subtitle: 'Farm Categories', display_order: 1 },
      { id: 'sec-feat', type: 'featured_products', title: 'Handpicked Fresh Today', subtitle: 'Harvest Highlights', display_order: 2 },
      { id: 'sec-best', type: 'best_sellers', title: 'Top Community Favorites', subtitle: 'Most Ordered Produce', display_order: 3 },
      { id: 'sec-promo', type: 'promotional_banner', title: 'Super Saver Farm Offer', subtitle: 'Flat 20% OFF with code FRESH20', description: 'Enjoy handpicked crispy leafy greens and root vegetables at unbeatable farm-gate prices.', button_text: 'Claim Offer Now', button_link: '/products', display_order: 4, configuration: { coupon_code: 'FRESH20' } },
      { id: 'sec-why', type: 'why_choose_us', title: 'Why Choose Fresh Vegetables?', subtitle: 'The Pure Farm Promise', display_order: 5 },
      { id: 'sec-testi', type: 'testimonials', title: 'Trusted by Over 50,000+ Homes', subtitle: 'Real Customer Stories', display_order: 6 },
      { id: 'sec-app', type: 'app_promotion', title: 'Freshness on the Go', subtitle: 'Progressive Mobile App', display_order: 7 }
    ];

    let allCategories: any[] = [];
    let allProducts: any[] = [];

    try {
      const [categoriesRes, productsRes, variantsRes] = await Promise.all([
        db.query("SELECT * FROM categories WHERE status = 'active' ORDER BY display_order ASC"),
        db.query("SELECT * FROM products WHERE status = 'active'"),
        db.query("SELECT * FROM product_variants WHERE status = 'active' ORDER BY selling_price ASC"),
      ]);
      const allVariants = variantsRes.rows || [];
      allCategories = (categoriesRes.rows || []).filter((c: any) => c.status === 'active');
      allProducts = (productsRes.rows || []).filter((p: any) => p.status === 'active').map((p: any) => ({
        ...p,
        variants: allVariants.filter((v: any) => v.product_id === p.id && v.status === 'active'),
      }));
    } catch {
      allCategories = (memoryStore.categories || []).filter((c: any) => c.status === 'active');
      allProducts = (memoryStore.products || []).filter((p: any) => p.status === 'active');
    }

    // Attach enriched preview products or categories for specific rail types
    // NEVER inject hardcoded fake products: only products verified active in database catalog
    const enrichedSections = activeSections.map((sec: any) => {
      let enrichedData: any = {};
      if (sec.type === 'categories') {
        enrichedData.categories = allCategories;
      } else if (sec.type === 'featured_products' || sec.type === 'fresh_arrivals') {
        const feat = allProducts.filter((p: any) => p.status === 'active' && p.featured);
        enrichedData.products = feat.slice(0, 8);
      } else if (sec.type === 'best_sellers') {
        const best = allProducts.filter((p: any) => p.status === 'active' && p.best_seller);
        enrichedData.products = best.slice(0, 8);
      } else if (sec.type === 'hero_banner') {
        enrichedData.banners = activeBanners;
      }
      return {
        ...sec,
        ...enrichedData,
      };
    });

    const payload = {
      sections: enrichedSections,
      banners: activeBanners,
    };

    // Cache for 5 minutes
    cache.set('cms:homepage', payload, 300);

    sendSuccess(res, 'Homepage CMS data loaded', payload);
  } catch (error) {
    next(error);
  }
}

export async function getHomepagePreview(req: Request, res: Response, next: NextFunction) {
  try {
    let rawSections: any[] = [];
    let rawBanners: any[] = [];

    try {
      const sectionsRes = await db.query(`SELECT * FROM homepage_sections ORDER BY display_order ASC`);
      const bannersRes = await db.query(`SELECT * FROM homepage_banners ORDER BY display_order ASC`);
      rawSections = sectionsRes.rows || [];
      rawBanners = bannersRes.rows || [];
    } catch {
      rawSections = (memoryStore as any).homepage_sections || [];
      rawBanners = (memoryStore as any).homepage_banners || [];
    }

    let allCategories: any[] = [];
    let allProducts: any[] = [];

    try {
      const [categoriesRes, productsRes, variantsRes] = await Promise.all([
        db.query("SELECT * FROM categories WHERE status = 'active' ORDER BY display_order ASC"),
        db.query("SELECT * FROM products WHERE status = 'active'"),
        db.query("SELECT * FROM product_variants WHERE status = 'active' ORDER BY selling_price ASC"),
      ]);
      const allVariants = variantsRes.rows || [];
      allCategories = categoriesRes.rows || [];
      allProducts = (productsRes.rows || []).map((p: any) => ({
        ...p,
        variants: allVariants.filter((v: any) => v.product_id === p.id && v.status === 'active'),
      }));
    } catch {
      allCategories = (memoryStore.categories || []).filter((c: any) => c.status === 'active');
      allProducts = (memoryStore.products || []).filter((p: any) => p.status === 'active');
    }

    const enrichedSections = rawSections.map((sec: any) => {
      let enrichedData: any = {};
      if (sec.type === 'categories') {
        enrichedData.categories = allCategories;
      } else if (sec.type === 'featured_products' || sec.type === 'fresh_arrivals') {
        enrichedData.products = allProducts.filter((p: any) => p.status === 'active' && p.featured).slice(0, 8);
      } else if (sec.type === 'best_sellers') {
        enrichedData.products = allProducts.filter((p: any) => p.status === 'active' && p.best_seller).slice(0, 8);
      } else if (sec.type === 'hero_banner') {
        enrichedData.banners = rawBanners;
      }
      return {
        ...sec,
        ...enrichedData,
      };
    });

    sendSuccess(res, 'Homepage CMS preview data (including draft/scheduled)', {
      sections: enrichedSections,
      banners: rawBanners,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAllSectionsAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    let rows: any[] = [];
    try {
      const resSections = await db.query(`SELECT * FROM homepage_sections ORDER BY display_order ASC`);
      rows = resSections.rows || [];
    } catch {
      rows = (memoryStore as any).homepage_sections || [];
    }
    sendSuccess(res, 'All homepage CMS sections for admin', rows);
  } catch (error) {
    next(error);
  }
}

export async function createSectionAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      type,
      title,
      subtitle,
      description,
      image,
      button_text,
      button_link,
      display_order,
      status,
      start_date,
      end_date,
      configuration,
    } = req.body;

    // Validate and sanitize content
    const sanitizedTitle = sanitizeText(title) || 'New Section';
    const sanitizedSubtitle = sanitizeText(subtitle);
    const sanitizedDesc = sanitizeText(description);
    const sanitizedBtnText = sanitizeText(button_text) || 'Shop Now';
    const sanitizedBtnLink = sanitizeText(button_link) || '/products';

    if (image && !isValidImageUrl(image)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_IMAGE_URL',
        message: 'Invalid section image URL. Please provide a valid HTTP/HTTPS or uploaded image path.',
      });
    }

    if (button_link && !isValidLinkUrl(button_link)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_LINK_URL',
        message: 'Invalid button link URL. Script URLs and dangerous schemes are prohibited.',
      });
    }

    const orderNum = display_order !== undefined && !isNaN(Number(display_order))
      ? Math.max(0, Math.floor(Number(display_order)))
      : 99;

    const validStatus = status === 'inactive' || status === 'scheduled' ? status : 'active';
    const newId = uuidv4();

    const newSection = {
      id: newId,
      type: type || 'promotional_banner',
      title: sanitizedTitle,
      subtitle: sanitizedSubtitle,
      description: sanitizedDesc,
      image: image || '',
      button_text: sanitizedBtnText,
      button_link: sanitizedBtnLink,
      display_order: orderNum,
      status: validStatus,
      start_date: start_date || null,
      end_date: end_date || null,
      configuration: configuration || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (!(memoryStore as any).homepage_sections) {
      (memoryStore as any).homepage_sections = [];
    }
    (memoryStore as any).homepage_sections.push(newSection);

    try {
      await db.query(
        `INSERT INTO homepage_sections (id, type, title, subtitle, description, image, button_text, button_link, display_order, status, start_date, end_date, configuration)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          newId,
          newSection.type,
          newSection.title,
          newSection.subtitle,
          newSection.description,
          newSection.image,
          newSection.button_text,
          newSection.button_link,
          orderNum,
          newSection.status,
          start_date || null,
          end_date || null,
          JSON.stringify(configuration || {}),
        ]
      );
    } catch {}

    // Strict cache invalidation
    cache.invalidate('cms:homepage');

    await logAuditEvent({
      req,
      action: 'HOMEPAGE_SECTION_CREATED',
      entityType: 'homepage_section',
      entityId: newSection.id,
      newValues: newSection,
    });

    sendSuccess(res, 'Homepage section created successfully', newSection, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateSectionAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const body = req.body;

    let existing: any = null;
    try {
      const existingRes = await db.query('SELECT * FROM homepage_sections WHERE id = $1', [id]);
      if (existingRes.rows.length > 0) existing = existingRes.rows[0];
    } catch {}

    if (!existing) {
      existing = (memoryStore as any).homepage_sections?.find((s: any) => s.id === id);
    }

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }

    if (body.image && !isValidImageUrl(body.image)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_IMAGE_URL',
        message: 'Invalid section image URL. Please provide a valid HTTP/HTTPS or uploaded image path.',
      });
    }

    if (body.button_link && !isValidLinkUrl(body.button_link)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_LINK_URL',
        message: 'Invalid button link URL. Script URLs and dangerous schemes are prohibited.',
      });
    }

    const sanitizedTitle = body.title !== undefined ? sanitizeText(body.title) : existing.title;
    const sanitizedSubtitle = body.subtitle !== undefined ? sanitizeText(body.subtitle) : existing.subtitle;
    const sanitizedDesc = body.description !== undefined ? sanitizeText(body.description) : existing.description;
    const sanitizedBtnText = body.button_text !== undefined ? sanitizeText(body.button_text) : existing.button_text;
    const sanitizedBtnLink = body.button_link !== undefined ? sanitizeText(body.button_link) : existing.button_link;

    const oldValues = { ...existing };
    const merged = {
      ...existing,
      ...body,
      title: sanitizedTitle,
      subtitle: sanitizedSubtitle,
      description: sanitizedDesc,
      button_text: sanitizedBtnText,
      button_link: sanitizedBtnLink,
      updated_at: new Date().toISOString(),
    };

    const memSec = (memoryStore as any).homepage_sections?.find((s: any) => s.id === id);
    if (memSec) {
      Object.assign(memSec, merged);
    }

    try {
      await db.query(
        `UPDATE homepage_sections
         SET title = $1, subtitle = $2, description = $3, image = $4,
             button_text = $5, button_link = $6, status = $7,
             start_date = $8, end_date = $9, configuration = $10, updated_at = NOW()
         WHERE id = $11`,
        [
          merged.title,
          merged.subtitle,
          merged.description,
          merged.image,
          merged.button_text,
          merged.button_link,
          merged.status,
          merged.start_date || null,
          merged.end_date || null,
          JSON.stringify(merged.configuration || {}),
          id,
        ]
      );
    } catch {}

    // Strict cache invalidation
    cache.invalidate('cms:homepage');

    await logAuditEvent({
      req,
      action: 'HOMEPAGE_SECTION_UPDATED',
      entityType: 'homepage_section',
      entityId: id,
      oldValues,
      newValues: merged,
    });

    sendSuccess(res, 'Homepage section updated successfully', merged);
  } catch (error) {
    next(error);
  }
}

export async function toggleSectionStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    let existing: any = null;
    try {
      const existingRes = await db.query('SELECT * FROM homepage_sections WHERE id = $1', [id]);
      if (existingRes.rows.length > 0) existing = existingRes.rows[0];
    } catch {}

    if (!existing) {
      existing = (memoryStore as any).homepage_sections?.find((s: any) => s.id === id);
    }

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }

    const nextStatus = existing.status === 'active' ? 'inactive' : 'active';
    existing.status = nextStatus;

    const memSec = (memoryStore as any).homepage_sections?.find((s: any) => s.id === id);
    if (memSec) {
      memSec.status = nextStatus;
    }

    try {
      await db.query(`UPDATE homepage_sections SET status = $1, updated_at = NOW() WHERE id = $2`, [nextStatus, id]);
    } catch {}

    // Strict cache invalidation
    cache.invalidate('cms:homepage');

    await logAuditEvent({
      req,
      action: 'HOMEPAGE_SECTION_STATUS_TOGGLED',
      entityType: 'homepage_section',
      entityId: id,
      newValues: { status: nextStatus },
    });

    sendSuccess(res, `Section status updated to ${nextStatus}`, { ...existing, status: nextStatus });
  } catch (error) {
    next(error);
  }
}

export async function reorderSections(req: Request, res: Response, next: NextFunction) {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_ORDER_PAYLOAD',
        message: 'Order payload must be an array of { id: string, display_order: number } objects.',
      });
    }

    for (const item of order) {
      if (!item.id || typeof item.display_order !== 'number' || item.display_order < 0) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_SECTION_ORDER_ENTRY',
          message: 'Each order entry must provide a valid section id and non-negative display_order integer.',
        });
      }

      const memSec = (memoryStore as any).homepage_sections?.find((s: any) => s.id === item.id);
      if (memSec) memSec.display_order = item.display_order;

      try {
        await db.query(
          `UPDATE homepage_sections SET display_order = $1, updated_at = NOW() WHERE id = $2`,
          [item.display_order, item.id]
        );
      } catch {}
    }

    (memoryStore as any).homepage_sections?.sort((a: any, b: any) => a.display_order - b.display_order);

    // Strict cache invalidation
    cache.invalidate('cms:homepage');

    await logAuditEvent({
      req,
      action: 'HOMEPAGE_SECTIONS_REORDERED',
      entityType: 'homepage_sections',
      newValues: order,
    });

    let refreshed: any[] = [];
    try {
      const resDb = await db.query(`SELECT * FROM homepage_sections ORDER BY display_order ASC`);
      refreshed = resDb.rows || [];
    } catch {
      refreshed = (memoryStore as any).homepage_sections || [];
    }

    sendSuccess(res, 'Homepage sections reordered successfully', refreshed);
  } catch (error) {
    next(error);
  }
}

export async function deleteSection(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    try {
      await db.query(`DELETE FROM homepage_sections WHERE id = $1`, [id]);
    } catch {}

    const memIdx = (memoryStore as any).homepage_sections?.findIndex((s: any) => s.id === id);
    if (memIdx !== -1 && memIdx !== undefined) {
      (memoryStore as any).homepage_sections.splice(memIdx, 1);
    }

    // Strict cache invalidation
    cache.invalidate('cms:homepage');

    await logAuditEvent({
      req,
      action: 'HOMEPAGE_SECTION_DELETED',
      entityType: 'homepage_section',
      entityId: id,
    });

    sendSuccess(res, 'Homepage section deleted successfully', { id });
  } catch (error) {
    next(error);
  }
}

// ================= BANNERS MANAGEMENT =================
export async function getBannersAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    let rows: any[] = [];
    try {
      const result = await db.query(`SELECT * FROM homepage_banners ORDER BY display_order ASC`);
      rows = result.rows || [];
    } catch {
      rows = (memoryStore as any).homepage_banners || [];
    }
    sendSuccess(res, 'Homepage banners for admin', rows);
  } catch (error) {
    next(error);
  }
}

export async function createBannerAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, subtitle, link, badge, display_order, status, section_id } = req.body;
    let image = req.body.image || '';
    if (req.file) {
      try {
        if (fs.existsSync(req.file.path)) {
          const buf = fs.readFileSync(req.file.path);
          image = `data:${req.file.mimetype};base64,${buf.toString('base64')}`;
          fs.unlink(req.file.path, () => {});
        } else {
          image = `/uploads/banners/${req.file.filename}`;
        }
      } catch {
        image = `/uploads/banners/${req.file.filename}`;
      }
    }

    if (image && !isValidImageUrl(image)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_BANNER_IMAGE',
        message: 'Invalid banner image URL. Please provide a valid HTTP/HTTPS or uploaded image path.',
      });
    }

    if (link && !isValidLinkUrl(link)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_BANNER_LINK',
        message: 'Invalid banner destination link. Script URLs and dangerous schemes are prohibited.',
      });
    }

    const sanitizedTitle = sanitizeText(title) || 'Farm Fresh Banner';
    const sanitizedSubtitle = sanitizeText(subtitle);
    const sanitizedBadge = sanitizeText(badge) || 'Fresh Harvest';

    let secId = section_id;
    if (!secId || secId === 'sec-hero-01') {
      secId = null;
    }
    const newId = uuidv4();
    const newBanner = {
      id: newId,
      section_id: secId,
      title: sanitizedTitle,
      subtitle: sanitizedSubtitle,
      image: image || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=1200',
      link: link || '/products',
      badge: sanitizedBadge,
      display_order: display_order !== undefined ? Number(display_order) : 1,
      status: status === 'inactive' ? 'inactive' : 'active',
      created_at: new Date().toISOString(),
    };

    if (!(memoryStore as any).homepage_banners) {
      (memoryStore as any).homepage_banners = [];
    }
    (memoryStore as any).homepage_banners.push(newBanner);

    try {
      await db.query(
        `INSERT INTO homepage_banners (id, section_id, title, subtitle, image, link, badge, display_order, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          newId,
          secId,
          newBanner.title,
          newBanner.subtitle,
          newBanner.image,
          newBanner.link,
          newBanner.badge,
          newBanner.display_order,
          newBanner.status,
        ]
      );
    } catch {}

    // Strict cache invalidation
    cache.invalidate('cms:homepage');
    sendSuccess(res, 'Homepage banner created', newBanner, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateBannerAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { title, subtitle, link, badge, status } = req.body;
    let image = req.body.image;
    if (req.file) {
      try {
        if (fs.existsSync(req.file.path)) {
          const buf = fs.readFileSync(req.file.path);
          image = `data:${req.file.mimetype};base64,${buf.toString('base64')}`;
          fs.unlink(req.file.path, () => {});
        } else {
          image = `/uploads/banners/${req.file.filename}`;
        }
      } catch {
        image = `/uploads/banners/${req.file.filename}`;
      }
    }

    if (image && !isValidImageUrl(image)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_BANNER_IMAGE',
        message: 'Invalid banner image URL. Please provide a valid HTTP/HTTPS or uploaded image path.',
      });
    }

    if (link && !isValidLinkUrl(link)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_BANNER_LINK',
        message: 'Invalid banner destination link. Script URLs and dangerous schemes are prohibited.',
      });
    }

    const memBnr = (memoryStore as any).homepage_banners?.find((b: any) => b.id === id);
    const finalImage = image !== undefined ? image : (memBnr?.image || '');

    const sanitizedTitle = title !== undefined ? sanitizeText(title) : memBnr?.title;
    const sanitizedSubtitle = subtitle !== undefined ? sanitizeText(subtitle) : memBnr?.subtitle;
    const sanitizedBadge = badge !== undefined ? sanitizeText(badge) : memBnr?.badge;

    if (memBnr) {
      Object.assign(memBnr, {
        ...req.body,
        title: sanitizedTitle,
        subtitle: sanitizedSubtitle,
        badge: sanitizedBadge,
        image: finalImage,
      });
    }

    try {
      await db.query(
        `UPDATE homepage_banners
         SET title = $1, subtitle = $2, image = $3, link = $4, badge = $5, status = $6
         WHERE id = $7`,
        [sanitizedTitle, sanitizedSubtitle, finalImage, link, sanitizedBadge, status, id]
      );
    } catch {}

    // Strict cache invalidation
    cache.invalidate('cms:homepage');
    sendSuccess(res, 'Homepage banner updated', memBnr || { id, title: sanitizedTitle, subtitle: sanitizedSubtitle, image: finalImage, link, badge: sanitizedBadge, status });
  } catch (error) {
    next(error);
  }
}

export async function deleteBannerAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    try {
      await db.query(`DELETE FROM homepage_banners WHERE id = $1`, [id]);
    } catch {}

    const memIdx = (memoryStore as any).homepage_banners?.findIndex((b: any) => b.id === id);
    if (memIdx !== -1 && memIdx !== undefined) {
      (memoryStore as any).homepage_banners.splice(memIdx, 1);
    }

    // Strict cache invalidation
    cache.invalidate('cms:homepage');
    sendSuccess(res, 'Homepage banner deleted', { id });
  } catch (error) {
    next(error);
  }
}

export async function getStoreSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const cached = cache.get('cms:settings');
    if (cached) {
      return sendSuccess(res, 'Store settings (cached)', cached);
    }

    let settingRow: any = null;
    try {
      const result = await db.query('SELECT * FROM store_settings WHERE id = $1', ['global_store_settings']);
      if (result.rows.length > 0) {
        settingRow = result.rows[0];
      }
    } catch {}

    if (!settingRow) {
      settingRow = {
        id: 'global_store_settings',
        support_phone: '+91 8106970384',
        support_email: 'freshvegitables29@gmail.com',
        announcement_text: 'Same-Day Farm Delivery for orders placed before 2:00 PM',
        store_address: 'Hyderabad, Telangana - Two Hub Delivery',
        quality_badge: '100% Genuine Certified Organic Harvest',
      };
    }

    // Cache store settings for 5 minutes
    cache.set('cms:settings', settingRow, 300);

    sendSuccess(res, 'Store settings fetched', settingRow);
  } catch (error) {
    next(error);
  }
}

export async function updateStoreSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const { support_phone, support_email, announcement_text, store_address, quality_badge } = req.body;

    const sanitizedPhone = sanitizeText(support_phone) || '+91 8106970384';
    const sanitizedEmail = sanitizeText(support_email) || 'freshvegitables29@gmail.com';
    const sanitizedAnnouncement = sanitizeText(announcement_text);
    const sanitizedAddress = sanitizeText(store_address) || 'Hyderabad, Telangana';
    const sanitizedQuality = sanitizeText(quality_badge) || '100% Genuine Certified Organic Harvest';

    let updated: any = null;

    try {
      const result = await db.query(`
        INSERT INTO store_settings (id, support_phone, support_email, announcement_text, store_address, quality_badge, updated_at)
        VALUES ('global_store_settings', $1, $2, $3, $4, $5, NOW())
        ON CONFLICT (id) DO UPDATE SET
          support_phone = COALESCE($1, store_settings.support_phone),
          support_email = COALESCE($2, store_settings.support_email),
          announcement_text = COALESCE($3, store_settings.announcement_text),
          store_address = COALESCE($4, store_settings.store_address),
          quality_badge = COALESCE($5, store_settings.quality_badge),
          updated_at = NOW()
        RETURNING *
      `, [
        sanitizedPhone,
        sanitizedEmail,
        sanitizedAnnouncement,
        sanitizedAddress,
        sanitizedQuality,
      ]);
      updated = result.rows[0];
    } catch {}

    if (!updated) {
      updated = {
        id: 'global_store_settings',
        support_phone: sanitizedPhone,
        support_email: sanitizedEmail,
        announcement_text: sanitizedAnnouncement,
        store_address: sanitizedAddress,
        quality_badge: sanitizedQuality,
      };
    }

    // Strict cache invalidation
    cache.invalidate('cms:homepage');
    cache.invalidate('cms:settings');

    sendSuccess(res, 'Store settings updated', updated);
  } catch (error) {
    next(error);
  }
}
