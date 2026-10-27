import { Request, Response, NextFunction } from 'express';
import { memoryStore } from '../config/mockDb';
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
    const products = memoryStore.products;
    const categories = memoryStore.categories;
    const baseUrl = env.FRONTEND_URL || 'http://localhost:5173';

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>Fresh Vegetables — Farm-Fresh Organic Grocery Store</title>
    <link>${baseUrl}</link>
    <description>Daily harvested farm-fresh organic vegetables, leafy greens and roots delivered in 30 minutes.</description>
`;

    for (const p of products) {
      if (p.status !== 'active') continue;
      const category = categories.find((c) => c.id === p.category_id);
      const isAvailable = p.stock_quantity > 0 ? 'in_stock' : 'out_of_stock';
      const mainImage = (p.images && p.images[0]) || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800';

      xml += `    <item>
      <g:id>${escapeXml(p.id)}</g:id>
      <g:title>${escapeXml(p.name)}</g:title>
      <g:description>${escapeXml(p.description || `Fresh, farm-harvested ${p.name}. Direct from regional organic farmers.`)}</g:description>
      <g:link>${baseUrl}/products/${escapeXml(p.slug)}</g:link>
      <g:image_link>${escapeXml(mainImage)}</g:image_link>
      <g:condition>new</g:condition>
      <g:availability>${isAvailable}</g:availability>
      <g:price>${p.selling_price.toFixed(2)} INR</g:price>
      <g:brand>Fresh Vegetables Organic</g:brand>
      <g:product_type>${escapeXml(category?.name || 'Fresh Produce')}</g:product_type>
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
    const products = memoryStore.products;
    const categories = memoryStore.categories;
    const baseUrl = env.FRONTEND_URL || 'http://localhost:5173';
    const now = new Date().toISOString().slice(0, 10);

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
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/subscriptions</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;

    // Dynamic Category URLs
    for (const cat of categories) {
      if (cat.status !== 'active') continue;
      xml += `  <url>
    <loc>${baseUrl}/products?category=${escapeXml(cat.slug)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.85</priority>
  </url>
`;
    }

    // Dynamic Product URLs
    for (const p of products) {
      if (p.status !== 'active') continue;
      xml += `  <url>
    <loc>${baseUrl}/products/${escapeXml(p.slug)}</loc>
    <lastmod>${now}</lastmod>
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
  const baseUrl = env.FRONTEND_URL || 'http://localhost:5173';
  const robots = `User-agent: *
Allow: /
Allow: /products
Allow: /products/*
Disallow: /admin
Disallow: /checkout
Disallow: /profile
Disallow: /orders

Sitemap: ${baseUrl}/sitemap.xml
`;
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.send(robots);
}
