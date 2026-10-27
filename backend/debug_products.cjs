const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:db_555a87fd0e63780985202c70@localhost:5432/fresh_vegetables' });

async function debug() {
  try {
    const rawCount = await pool.query('SELECT count(*) FROM products');
    console.log('1. Raw count from products table:', rawCount.rows[0]);

    const activeCount = await pool.query("SELECT count(*) FROM products WHERE status = 'active'");
    console.log('2. Active count from products table:', activeCount.rows[0]);

    const countQuery = `SELECT COUNT(*)::int as total FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.status = 'active'`;
    const countResult = await pool.query(countQuery, []);
    console.log('3. Controller countQuery:', countResult.rows[0]);

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
    const dataResult = await pool.query(dataQuery, [20, 0]);
    console.log('4. Controller dataQuery rows:', dataResult.rows.length);
    if (dataResult.rows.length > 0) {
      console.log('Sample product:', dataResult.rows[0].name);
    }
  } catch (err) {
    console.error('Error in debug:', err);
  } finally {
    await pool.end();
  }
}

debug();
