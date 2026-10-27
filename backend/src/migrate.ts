import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { env } from './config/env';

async function runMigrations() {
  console.log('🔄 Initializing PostgreSQL database migration runner...');
  const migrationsDir = path.resolve(__dirname, '../../database/migrations');

  if (!fs.existsSync(migrationsDir)) {
    console.error(`❌ Migrations folder not found at ${migrationsDir}`);
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 3000,
  });

  let client;
  try {
    client = await pool.connect();
    const res = await client.query('SELECT current_database(), version()');
    console.log(`✅ Connected to real PostgreSQL: ${res.rows[0].current_database}`);
  } catch (err: any) {
    console.error('❌ Cannot run migrations: PostgreSQL is not reachable.');
    console.error(`   Code: ${err.code || 'UNKNOWN'}`);
    console.error(`   Message: ${err.message}`);
    console.error('   Please start your PostgreSQL service and verify that the database exists before migrating.');
    await pool.end();
    process.exit(1);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files: ${files.join(', ')}`);

  try {
    for (const file of files) {
      const fullPath = path.join(migrationsDir, file);
      console.log(`Executing ${file}...`);
      const sql = fs.readFileSync(fullPath, 'utf8');
      await client.query(sql);
      console.log(`✅ ${file} applied successfully.`);
    }

    console.log('🎉 All PostgreSQL migrations completed successfully!');
    client.release();
    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (client) client.release();
    await pool.end();
    process.exit(1);
  }
}

runMigrations();
