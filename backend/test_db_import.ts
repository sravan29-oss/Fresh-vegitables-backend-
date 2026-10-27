import db from './src/config/database';

async function test() {
  console.log('Testing db.query...');
  const countQuery = `SELECT COUNT(*)::int as total FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.status = 'active'`;
  const res = await db.query(countQuery, []);
  console.log('db.query result:', res.rows);

  const dataQuery = `
    SELECT p.id, p.name, p.slug, p.category_id, p.description, p.images, p.unit,
           p.mrp, p.selling_price, p.stock_quantity, p.minimum_stock,
           p.status, p.featured, p.best_seller, p.created_at,
           c.name as category_name, c.slug as category_slug
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.status = 'active'
    ORDER BY p.best_seller DESC, p.featured DESC, p.created_at DESC
    LIMIT $1 OFFSET $2
  `;
  const dataRes = await db.query(dataQuery, [20, 0]);
  console.log('db.query data rows length:', dataRes.rows.length);
  process.exit(0);
}

test();
