const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'fresh_vegetables',
});

async function run() {
  try {
    const res = await pool.query(
      "DELETE FROM homepage_banners WHERE title ILIKE '%Persistence Verification%' OR subtitle ILIKE '%PostgreSQL Storage%' RETURNING *"
    );
    console.log('DELETED COUNT:', res.rowCount);
    console.log('DELETED ROWS:', res.rows);
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await pool.end();
  }
}

run();
