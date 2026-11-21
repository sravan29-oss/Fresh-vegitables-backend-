import { Request, Response, NextFunction } from 'express';
import { memoryStore } from '../config/mockDb';
import { db } from '../config/database';
import { env } from '../config/env';

// Helper to sanitize XML text
function escapeXml(unsafe: string = ''): string {
  return String(unsafe)
    .replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
}

export async function getGoogleShoppingFeed(req: Request, res: Response, next: NextFunction) {
  try {
    const baseUrl = env.FRONTEND_URL || 'https://fresh-vegetables-organic.vercel.app';
    const isFeedEnabled =
      process.env.GOOGLE_SHOPPING_FEED_ENABLED === 'true' ||
      req.query.preview === 'true' ||
      req.query.enabled === 'true';

    let productsList: any[] = [];
    let categoriesList: any[] = [];

    try {
      const [prodsRes, catsRes] = await Promise.all([
        db.query(`
          SELECT p.*, c.name as category_name, c.slug as category_slug
          FROM products p
          LEFT JOIN categories c ON p.category_id = c.id
          WHERE p.status = 'active' AND (p.sitemap_eligible IS NULL OR p.sitemap_eligible = TRUE)
          ORDER BY p.name ASC
        `),
        db.query(`
          SELECT * FROM categories
          WHERE status = 'active' AND slug != 'fresh-vegetables'
          ORDER BY display_order ASC
        `),
      ]);
      productsList = prodsRes.rows || [];
      categoriesList = catsRes.rows || [];
    } catch {
      productsList = (memoryStore.products || []).filter((p: any) => p.status === 'active');
      categoriesList = (memoryStore.categories || []).filter((c: any) => c.status === 'active' && c.slug !== 'fresh-vegetables');
    }

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>Fresh Vegetables Organic — Farm-Fresh Organic Grocery Store</title>
    <link>${baseUrl}</link>
    <description>Daily harvested farm-fresh organic vegetables, leafy greens and roots delivered within 5 km of Champapet &amp; KPHB hubs in Hyderabad.</description>
`;

    if (!isFeedEnabled) {
      xml += `    <!-- Google Shopping feed is currently in staging/draft mode. Keep feed disabled from public production submission until an admin explicitly enables it. To preview items, append ?preview=true or set GOOGLE_SHOPPING_FEED_ENABLED=true. -->
  </channel>
</rss>`;
      res.set('Content-Type', 'application/xml; charset=utf-8');
      return res.send(xml);
    }

    for (const p of productsList) {
      if (p.status !== 'active') continue;
      if (p.sitemap_eligible === false) continue;
      const isAvailable = Number(p.stock_quantity ?? 0) > 0 ? 'in_stock' : 'out_of_stock';
      const images = Array.isArray(p.images) ? p.images : (typeof p.images === 'string' ? JSON.parse(p.images) : []);
      const mainImage = (images && images[0]) || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800';
      const priceNum = Number(p.selling_price || 0);
      const cleanDesc = (p.description || '').replace(/<[^>]*>/g, '').trim();
      const descText = cleanDesc || `Fresh, farm-harvested ${p.name}. Direct from regional organic farmers in Hyderabad. Doorstep delivery within 5 km of Champapet and KPHB hubs.`;

      xml += `    <item>
      <g:id>${escapeXml(p.id)}</g:id>
      <g:title>${escapeXml(p.name)}</g:title>
      <g:description>${escapeXml(descText)}</g:description>
      <g:link>${baseUrl}/products/${escapeXml(p.slug)}</g:link>
      <g:image_link>${escapeXml(mainImage)}</g:image_link>
      <g:condition>new</g:condition>
      <g:availability>${isAvailable}</g:availability>
      <g:price>${priceNum.toFixed(2)} INR</g:price>
      <g:brand>Fresh Vegetables Organic</g:brand>
      <g:identifier_exists>no</g:identifier_exists>
      <g:product_type>${escapeXml(p.category_name || 'Fresh Produce')}</g:product_type>
      <g:google_product_category>Food, Beverages &amp; Tobacco &gt; Food Items &gt; Fresh &amp; Frozen Fruits &amp; Vegetables</g:google_product_category>
    </item>
`;
    }

    xml += `  </channel>
</rss>`;

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  } catch (error) {
    next(error);
  }
}

export async function getSitemapXml(req: Request, res: Response, next: NextFunction) {
  try {
    const baseUrl = env.FRONTEND_URL || 'https://fresh-vegetables-organic.vercel.app';
    const now = new Date().toISOString().slice(0, 10);

    let productsList: any[] = [];
    let categoriesList: any[] = [];
    try {
      const [prodsRes, catsRes] = await Promise.all([
        db.query("SELECT slug, updated_at, created_at, status FROM products WHERE status = 'active' AND (sitemap_eligible IS NULL OR sitemap_eligible = TRUE) ORDER BY name ASC"),
        db.query("SELECT slug, updated_at, created_at, status FROM categories WHERE status = 'active' AND slug != 'fresh-vegetables' ORDER BY display_order ASC"),
      ]);
      productsList = prodsRes.rows || [];
      categoriesList = catsRes.rows || [];
    } catch {
      productsList = (memoryStore.products || []).filter((p: any) => p.status === 'active');
      categoriesList = (memoryStore.categories || []).filter((c: any) => c.status === 'active' && c.slug !== 'fresh-vegetables');
    }

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Core Static Pages -->
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/products</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
`;

    // Dynamic Category URLs (Filtered & Validated)
    for (const cat of categoriesList) {
      if (cat.status !== 'active') continue;
      const catDate = cat.updated_at || cat.created_at ? new Date(cat.updated_at || cat.created_at).toISOString().slice(0, 10) : now;
      xml += `  <url>
    <loc>${baseUrl}/products?category=${escapeXml(cat.slug)}</loc>
    <lastmod>${catDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
`;
    }

    // Dynamic Active Product URLs
    for (const p of productsList) {
      if (p.status !== 'active') continue;
      const prodDate = p.updated_at || p.created_at ? new Date(p.updated_at || p.created_at).toISOString().slice(0, 10) : now;
      xml += `  <url>
    <loc>${baseUrl}/products/${escapeXml(p.slug)}</loc>
    <lastmod>${prodDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
`;
    }

    xml += `</urlset>`;

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  } catch (error) {
    next(error);
  }
}

export async function getRobotsTxt(req: Request, res: Response) {
  const baseUrl = env.FRONTEND_URL || 'https://fresh-vegetables-organic.vercel.app';
  const robots = `# Robots.txt for Fresh Vegetables Organic
# Canonical Domain: ${baseUrl}

User-agent: *
Allow: /
Allow: /products
Allow: /products/*

# Disallow Private & Administrative Sections
Disallow: /admin/
Disallow: /admin
Disallow: /api/
Disallow: /checkout
Disallow: /orders
Disallow: /orders/
Disallow: /order-success/
Disallow: /profile
Disallow: /wallet
Disallow: /login
Disallow: /register

# Canonical XML Sitemap
Sitemap: ${baseUrl}/sitemap.xml
`;
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.send(robots);
}
