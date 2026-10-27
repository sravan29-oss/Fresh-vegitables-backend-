const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fresh_vegetables',
  user: 'postgres',
  password: 'db_555a87fd0e63780985202c70',
});

async function seedSections() {
  const sections = [
    { type: 'categories', title: 'Shop by Harvest Category', subtitle: 'Farm Categories', display_order: 1 },
    { type: 'featured_products', title: 'Handpicked Fresh Today', subtitle: 'Harvest Highlights', display_order: 2 },
    { type: 'best_sellers', title: 'Top Community Favorites', subtitle: 'Most Ordered', display_order: 3 },
    {
      type: 'promotional_banner',
      title: 'Super Saver Monsoon Sale',
      subtitle: 'Flat 20% OFF with code FRESH20',
      description: 'Enjoy handpicked crispy leafy greens and root vegetables at unbeatable prices.',
      display_order: 4,
      configuration: JSON.stringify({ coupon_code: 'FRESH20' }),
    },
    { type: 'why_choose_us', title: 'Why Choose Fresh Vegetables?', subtitle: 'The Pure Farm Promise', display_order: 5 },
    { type: 'testimonials', title: 'Trusted by Over 50,000+ Homes', subtitle: 'Real Reviews', display_order: 6 },
    { type: 'app_promotion', title: 'Freshness on the Go', subtitle: 'Download Our App', display_order: 7 },
  ];

  for (const s of sections) {
    const ex = await pool.query('SELECT id FROM homepage_sections WHERE type = $1', [s.type]);
    if (ex.rows.length === 0) {
      await pool.query(
        'INSERT INTO homepage_sections (type, title, subtitle, description, display_order, status, configuration) VALUES ($1, $2, $3, $4, $5, \'active\', $6)',
        [s.type, s.title, s.subtitle, s.description || null, s.display_order, s.configuration || '{}']
      );
      console.log('Inserted section:', s.type);
    }
  }

  // Update hero_banner with the requested title and description
  await pool.query(
    `UPDATE homepage_sections 
     SET title = 'Freshness from Nature to Your Table',
         subtitle = '100% Certified Organic • Chemical Free Harvest',
         description = 'Discover fresh vegetables and bring the goodness of nature into your everyday meals.',
         button_text = 'Explore Fresh Vegetables',
         button_link = '/products'
     WHERE type = 'hero_banner'`
  );
  console.log('Updated hero banner details.');

  await pool.end();
}

seedSections().catch(console.error);
