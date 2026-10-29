import { Request, Response, NextFunction } from 'express';
import db from '../config/database';
import { memoryStore } from '../config/mockDb';
import { sendSuccess } from '../utils/apiResponse';
import cache from '../services/cache.service';
import { logAuditEvent } from '../services/audit.service';
import { v4 as uuidv4 } from 'uuid';

export async function getHomepageData(req: Request, res: Response, next: NextFunction) {
  try {
    const cached = cache.get('cms:homepage');
    if (cached) {
      return sendSuccess(res, 'Homepage CMS data (cached)', cached);
    }

    const sectionsRes = await db.query(
      `SELECT * FROM homepage_sections WHERE status = 'active' ORDER BY display_order ASC`
    );
    const bannersRes = await db.query(
      `SELECT * FROM homepage_banners WHERE status = 'active' ORDER BY display_order ASC`
    );

    const now = new Date();
    const rawActive = (sectionsRes.rows || []).filter((sec: any) => {
      if (sec.start_date && new Date(sec.start_date) > now) return false;
      if (sec.end_date && new Date(sec.end_date) < now) return false;
      return true;
    });

    const activeSections = rawActive.length > 0 ? rawActive : [
      { id: 'sec-hero', type: 'hero_banner', title: 'Freshness from Nature to Your Table', subtitle: '100% Certified Organic • Chemical Free Harvest', description: 'Discover fresh vegetables and bring the goodness of nature into your everyday meals.', button_text: 'Explore Fresh Vegetables', button_link: '/products', display_order: 1 },
      { id: 'sec-cats', type: 'categories', title: 'Shop by Harvest Category', subtitle: 'Farm Categories', display_order: 2 },
      { id: 'sec-feat', type: 'featured_products', title: 'Handpicked Fresh Today', subtitle: 'Harvest Highlights', display_order: 3 },
      { id: 'sec-best', type: 'best_sellers', title: 'Top Community Favorites', subtitle: 'Most Ordered Produce', display_order: 4 },
      { id: 'sec-promo', type: 'promotional_banner', title: 'Super Saver Farm Offer', subtitle: 'Flat 20% OFF with code FRESH20', description: 'Enjoy handpicked crispy leafy greens and root vegetables at unbeatable farm-gate prices.', button_text: 'Claim Offer Now', button_link: '/products', display_order: 5, configuration: { coupon_code: 'FRESH20' } },
      { id: 'sec-why', type: 'why_choose_us', title: 'Why Choose Fresh Vegetables?', subtitle: 'The Pure Farm Promise', display_order: 6 },
      { id: 'sec-testi', type: 'testimonials', title: 'Trusted by Over 50,000+ Homes', subtitle: 'Real Customer Stories', display_order: 7 },
      { id: 'sec-app', type: 'app_promotion', title: 'Freshness on the Go', subtitle: 'Progressive Mobile App', display_order: 8 }
    ];

    const banners = bannersRes.rows || [];

    // Pull active categories and products via database
    const [categoriesRes, productsRes] = await Promise.all([
      db.query("SELECT * FROM categories WHERE status = 'active' ORDER BY display_order ASC"),
      db.query("SELECT * FROM products WHERE status = 'active'"),
    ]);

    const allCategories = categoriesRes.rows || [];
    const allProducts = productsRes.rows || [];

    // Attach enriched preview products or categories for specific rail types
    const enrichedSections = activeSections.map((sec: any) => {
      let enrichedData: any = {};
      if (sec.type === 'categories') {
        enrichedData.categories = allCategories;
      } else if (sec.type === 'featured_products' || sec.type === 'fresh_arrivals') {
        const feat = allProducts.filter((p: any) => p.featured);
        enrichedData.products = (feat.length > 0 ? feat : allProducts).slice(0, 8);
      } else if (sec.type === 'best_sellers') {
        const best = allProducts.filter((p: any) => p.best_seller);
        enrichedData.products = (best.length > 0 ? best : allProducts).slice(0, 8);
      } else if (sec.type === 'hero_banner') {
        enrichedData.banners = banners;
      }
      return {
        ...sec,
        ...enrichedData,
      };
    });

    const payload = {
      sections: enrichedSections,
      banners,
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
    const sectionsRes = await db.query(
      `SELECT * FROM homepage_sections ORDER BY display_order ASC`
    );
    const bannersRes = await db.query(
      `SELECT * FROM homepage_banners ORDER BY display_order ASC`
    );

    const [categoriesRes, productsRes] = await Promise.all([
      db.query("SELECT * FROM categories WHERE status = 'active' ORDER BY display_order ASC"),
      db.query("SELECT * FROM products WHERE status = 'active'"),
    ]);

    const enrichedSections = (sectionsRes.rows || []).map((sec: any) => {
      let enrichedData: any = {};
      if (sec.type === 'categories') {
        enrichedData.categories = categoriesRes.rows || [];
      } else if (sec.type === 'featured_products' || sec.type === 'fresh_arrivals') {
        enrichedData.products = (productsRes.rows || []).filter((p: any) => p.featured).slice(0, 8);
      } else if (sec.type === 'best_sellers') {
        enrichedData.products = (productsRes.rows || []).filter((p: any) => p.best_seller).slice(0, 8);
      } else if (sec.type === 'hero_banner') {
        enrichedData.banners = bannersRes.rows || [];
      }
      return {
        ...sec,
        ...enrichedData,
      };
    });

    sendSuccess(res, 'Homepage CMS preview data (including draft/scheduled)', {
      sections: enrichedSections,
      banners: bannersRes.rows || [],
    });
  } catch (error) {
    next(error);
  }
}

export async function getAllSectionsAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const resSections = await db.query(`SELECT * FROM homepage_sections ORDER BY display_order ASC`);
    sendSuccess(res, 'All homepage CMS sections for admin', resSections.rows);
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

    const newId = uuidv4();
    const orderNum = display_order !== undefined ? Number(display_order) : 99;

    const result = await db.query(
      `INSERT INTO homepage_sections (id, type, title, subtitle, description, image, button_text, button_link, display_order, status, start_date, end_date, configuration)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        newId,
        type || 'promotional_banner',
        title || 'New Section',
        subtitle || '',
        description || '',
        image || '',
        button_text || 'Shop Now',
        button_link || '/products',
        orderNum,
        status || 'active',
        start_date || null,
        end_date || null,
        JSON.stringify(configuration || {}),
      ]
    );

    const created = result.rows[0];
    cache.invalidate('cms:homepage');

    await logAuditEvent({
      req,
      action: 'HOMEPAGE_SECTION_CREATED',
      entityType: 'homepage_section',
      entityId: created.id,
      newValues: created,
    });

    sendSuccess(res, 'Homepage section created successfully', created, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateSectionAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const body = req.body;

    const existingRes = await db.query('SELECT * FROM homepage_sections WHERE id = $1', [id]);
    const existing = existingRes.rows[0] || (memoryStore as any).homepage_sections?.find((s: any) => s.id === id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }

    const oldValues = { ...existing };
    const merged = { ...existing, ...body, updated_at: new Date().toISOString() };

    // Update in memory store directly for immediate synchronization
    const memSec = (memoryStore as any).homepage_sections?.find((s: any) => s.id === id);
    if (memSec) {
      Object.assign(memSec, merged);
    }

    // Try executing parameterized update in database
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
    const existingRes = await db.query('SELECT * FROM homepage_sections WHERE id = $1', [id]);
    const existing = existingRes.rows[0] || (memoryStore as any).homepage_sections?.find((s: any) => s.id === id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }

    const nextStatus = existing.status === 'active' ? 'inactive' : 'active';
    if (existingRes.rows.length > 0) {
      existingRes.rows[0].status = nextStatus;
    }
    const memSec = (memoryStore as any).homepage_sections?.find((s: any) => s.id === id);
    if (memSec) {
      memSec.status = nextStatus;
    }

    await db.query(`UPDATE homepage_sections SET status = $1, updated_at = NOW() WHERE id = $2`, [nextStatus, id]);

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
    const { order } = req.body; // Array of { id: string, display_order: number }
    if (Array.isArray(order)) {
      for (const item of order) {
        const memSec = (memoryStore as any).homepage_sections?.find((s: any) => s.id === item.id);
        if (memSec) memSec.display_order = item.display_order;

        await db.query(
          `UPDATE homepage_sections SET display_order = $1, updated_at = NOW() WHERE id = $2`,
          [item.display_order, item.id]
        );
      }
      (memoryStore as any).homepage_sections?.sort((a: any, b: any) => a.display_order - b.display_order);
    }

    cache.invalidate('cms:homepage');

    await logAuditEvent({
      req,
      action: 'HOMEPAGE_SECTIONS_REORDERED',
      entityType: 'homepage_sections',
      newValues: order,
    });

    const refreshed = await db.query(`SELECT * FROM homepage_sections ORDER BY display_order ASC`);
    sendSuccess(res, 'Homepage sections reordered successfully', refreshed.rows);
  } catch (error) {
    next(error);
  }
}

export async function deleteSection(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await db.query(`DELETE FROM homepage_sections WHERE id = $1`, [id]);
    const memIdx = (memoryStore as any).homepage_sections?.findIndex((s: any) => s.id === id);
    if (memIdx !== -1 && memIdx !== undefined) {
      (memoryStore as any).homepage_sections.splice(memIdx, 1);
    }

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
    const result = await db.query(`SELECT * FROM homepage_banners ORDER BY display_order ASC`);
    sendSuccess(res, 'Homepage banners for admin', result.rows || []);
  } catch (error) {
    next(error);
  }
}

export async function createBannerAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, subtitle, image, link, badge, display_order, status, section_id } = req.body;
    let secId = section_id;
    if (!secId || secId === 'sec-hero-01') {
      const heroSec = await db.query("SELECT id FROM homepage_sections WHERE type = 'hero_banner' LIMIT 1");
      secId = heroSec.rows[0]?.id || null;
    }
    const newId = uuidv4();
    const result = await db.query(
      `INSERT INTO homepage_banners (id, section_id, title, subtitle, image, link, badge, display_order, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        newId,
        secId,
        title,
        subtitle || '',
        image,
        link || '/products',
        badge || 'Fresh Harvest',
        display_order !== undefined ? Number(display_order) : 1,
        status || 'active',
      ]
    );

    cache.invalidate('cms:homepage');
    sendSuccess(res, 'Homepage banner created', result.rows[0], 201);
  } catch (error) {
    next(error);
  }
}

export async function updateBannerAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { title, subtitle, image, link, badge, status } = req.body;

    const memBnr = (memoryStore as any).homepage_banners?.find((b: any) => b.id === id);
    if (memBnr) {
      Object.assign(memBnr, req.body);
    }

    const result = await db.query(
      `UPDATE homepage_banners
       SET title = $1, subtitle = $2, image = $3, link = $4, badge = $5, status = $6
       WHERE id = $7
       RETURNING *`,
      [title, subtitle, image, link, badge, status, id]
    );

    cache.invalidate('cms:homepage');
    sendSuccess(res, 'Homepage banner updated', result.rows[0] || memBnr);
  } catch (error) {
    next(error);
  }
}

export async function deleteBannerAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await db.query(`DELETE FROM homepage_banners WHERE id = $1`, [id]);
    const memIdx = (memoryStore as any).homepage_banners?.findIndex((b: any) => b.id === id);
    if (memIdx !== -1 && memIdx !== undefined) {
      (memoryStore as any).homepage_banners.splice(memIdx, 1);
    }

    cache.invalidate('cms:homepage');
    sendSuccess(res, 'Homepage banner deleted', { id });
  } catch (error) {
    next(error);
  }
}

export async function getStoreSettings(req: Request, res: Response, next: NextFunction) {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS store_settings (
        id VARCHAR(50) PRIMARY KEY DEFAULT 'global_store_settings',
        support_phone VARCHAR(50) DEFAULT '+91 8106970384',
        support_email VARCHAR(100) DEFAULT 'freshvegitables29@gmail.com',
        announcement_text VARCHAR(255) DEFAULT 'Same-Day Farm Delivery for orders placed before 2:00 PM',
        store_address VARCHAR(255) DEFAULT 'Hyderabad, Telangana',
        quality_badge VARCHAR(100) DEFAULT '100% Genuine Certified Organic Harvest',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    let result = await db.query('SELECT * FROM store_settings WHERE id = $1', ['global_store_settings']);
    if (result.rows.length === 0) {
      result = await db.query(`
        INSERT INTO store_settings (id, support_phone, support_email, announcement_text, store_address, quality_badge)
        VALUES ('global_store_settings', '+91 8106970384', 'freshvegitables29@gmail.com', 'Same-Day Farm Delivery for orders placed before 2:00 PM', 'Hyderabad, Telangana', '100% Genuine Certified Organic Harvest')
        RETURNING *
      `);
    } else {
      // Auto-migrate legacy default values to real Hyderabad, Telangana address & genuine email
      const row = result.rows[0];
      if (
        row.support_email === 'care@freshveggies.com' ||
        !row.store_address ||
        row.store_address.includes('Sector 14') ||
        row.store_address.includes('Agro Valley')
      ) {
        result = await db.query(`
          UPDATE store_settings
          SET support_email = 'freshvegitables29@gmail.com',
              store_address = 'Hyderabad, Telangana',
              quality_badge = '100% Genuine Certified Organic Harvest',
              updated_at = NOW()
          WHERE id = 'global_store_settings'
          RETURNING *
        `);
      }
    }

    sendSuccess(res, 'Store settings fetched', result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function updateStoreSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const { support_phone, support_email, announcement_text, store_address, quality_badge } = req.body;
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
      support_phone || '+91 8106970384',
      support_email || 'freshvegitables29@gmail.com',
      announcement_text || 'Same-Day Farm Delivery for orders placed before 2:00 PM',
      store_address || 'Hyderabad, Telangana',
      quality_badge || '100% Genuine Certified Organic Harvest'
    ]);

    sendSuccess(res, 'Store settings updated', result.rows[0]);
  } catch (error) {
    next(error);
  }
}


