const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'fresh_vegetables',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'db_555a87fd0e63780985202c70',
});

async function main() {
  try {
    const hash = await bcrypt.hash('admin123', 10);
    const res = await pool.query(
      `UPDATE admins SET password = $1 RETURNING id, email, name, role`,
      [hash]
    );
    console.log('SUCCESS: Updated admin passwords to admin123:', res.rows);
    await pool.end();
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
}

main();
