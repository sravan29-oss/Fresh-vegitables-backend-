const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'fresh_vegetables',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'db_555a87fd0e63780985202c70',
});

async function clearData() {
  console.log('🧹 Purging all Products, Variants, and Categories from PostgreSQL...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Delete dependent items
    await client.query("DELETE FROM homepage_section_items WHERE item_type IN ('product', 'category')");
    await client.query("DELETE FROM cart_items");
    await client.query("DELETE FROM order_items");
    await client.query("DELETE FROM subscription_items");
    await client.query("DELETE FROM product_variants");

    // 2. Delete products
    const delProducts = await client.query("DELETE FROM products");
    console.log(`✅ Deleted ${delProducts.rowCount} products from PostgreSQL.`);

    // 3. Delete categories
    const delCategories = await client.query("DELETE FROM categories");
    console.log(`✅ Deleted ${delCategories.rowCount} categories from PostgreSQL.`);

    await client.query('COMMIT');

    // 4. Clear JSON stores
    const productsJson = path.join(__dirname, 'src', 'config', 'products.json');
    const variantsJson = path.join(__dirname, 'src', 'config', 'product_variants.json');
    if (fs.existsSync(productsJson)) {
      fs.writeFileSync(productsJson, '[]', 'utf8');
      console.log('✅ Cleared products.json');
    }
    if (fs.existsSync(variantsJson)) {
      fs.writeFileSync(variantsJson, '[]', 'utf8');
      console.log('✅ Cleared product_variants.json');
    }

    console.log('🎉 Successfully purged all Products and Categories across backend and database!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error during purge:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

clearData();
