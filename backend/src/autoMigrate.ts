import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { env } from './config/env';

/**
 * Automatically applies pending PostgreSQL migrations and seeds default data on startup.
 * Runs completely inside Node.js without requiring an interactive shell or paid subscription.
 */
export async function autoMigrateAndSeed(): Promise<void> {
  const candidateMigrationDirs = [
    path.resolve(process.cwd(), 'database/migrations'),
    path.resolve(process.cwd(), '../database/migrations'),
    path.resolve(__dirname, '../../database/migrations'),
    path.resolve(__dirname, '../../../database/migrations'),
  ];

  const migrationsDir = candidateMigrationDirs.find((dir) => fs.existsSync(dir));
  if (!migrationsDir) {
    console.warn('⚠️ [AutoMigrate] Migrations directory not found. Skipping auto-migration.');
    return;
  }

  const isLocalhost =
    env.DATABASE_URL.includes('localhost') ||
    env.DATABASE_URL.includes('127.0.0.1');

  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
    ...(isLocalhost ? {} : { ssl: { rejectUnauthorized: false } }),
  });

  let client;
  try {
    client = await pool.connect();
    console.log('🔄 [AutoMigrate] Connected to PostgreSQL. Verifying schema migrations...');

    // 1. Create tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        id VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const appliedRes = await client.query('SELECT id FROM _schema_migrations');
    const appliedSet = new Set(appliedRes.rows.map((r: any) => r.id));

    // 2. Read migration files
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (appliedSet.has(file)) {
        continue; // Already applied
      }

      console.log(`🔄 [AutoMigrate] Applying ${file}...`);
      const fullPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(fullPath, 'utf8');
      await client.query(sql);
      await client.query('INSERT INTO _schema_migrations (id) VALUES ($1)', [file]);
      console.log(`✅ [AutoMigrate] Applied ${file}`);
    }

    // 3. Check if seed is needed
    try {
      const catCheck = await client.query('SELECT COUNT(*)::int as count FROM categories');
      if (catCheck.rows[0].count === 0) {
        const candidateSeedPaths = [
          path.resolve(process.cwd(), 'database/seed/seed.sql'),
          path.resolve(process.cwd(), '../database/seed/seed.sql'),
          path.resolve(__dirname, '../../database/seed/seed.sql'),
          path.resolve(__dirname, '../../../database/seed/seed.sql'),
        ];
        const seedPath = candidateSeedPaths.find((p) => fs.existsSync(p));
        if (seedPath) {
          console.log('🌱 [AutoMigrate] Database has 0 categories. Applying initial seed data...');
          const seedSql = fs.readFileSync(seedPath, 'utf8');
          await client.query(seedSql);
          console.log('✅ [AutoMigrate] Seed data inserted successfully!');
        }
      }
    } catch (seedErr: any) {
      console.warn('⚠️ [AutoMigrate] Seeding check note:', seedErr.message);
    }

    console.log('🎉 [AutoMigrate] PostgreSQL database schema is fully initialized and up-to-date!');
  } catch (err: any) {
    console.warn(`⚠️ [AutoMigrate] Database auto-migration note: ${err.message}`);
  } finally {
    if (client) client.release();
    await pool.end().catch(() => {});
  }
}
