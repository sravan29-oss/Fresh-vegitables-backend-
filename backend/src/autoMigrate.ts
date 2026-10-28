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

    // 4. Ensure Category 'Fresh' and the 6 Admin Products are always synced and present
    try {
      await client.query(`
        INSERT INTO categories (id, name, slug, description, image, status, display_order)
        VALUES ('8e8bbc30-1625-4f6b-8b5f-6c33ae7501cd', 'Fresh', 'fresh', 'Farm-fresh organic vegetables delivered to your doorstep', '/uploads/categories/fresh-vegetables.jpg', 'active', 1)
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          status = 'active',
          display_order = 1;
      `);

      await client.query(`
        INSERT INTO products (id, name, slug, category_id, description, images, unit, mrp, selling_price, stock_quantity, minimum_stock, status, featured, best_seller)
        VALUES
        ('faf5d663-3868-40a9-8933-ed0560ec4c53', 'Tomato', 'tomato', '8e8bbc30-1625-4f6b-8b5f-6c33ae7501cd', 'Fresh From Market When order reach', ARRAY['/uploads/products/e617cc8b-b81d-4b2c-b622-8c9cc407fd85.webp'], '500grms', 28.00, 25.00, 41, 5, 'active', true, true),
        ('344f868a-89e0-425c-aeef-8d34533b29f0', 'Lady Finger', 'lady-finger', '8e8bbc30-1625-4f6b-8b5f-6c33ae7501cd', 'Fresh organic tender lady fingers (bhindi)', ARRAY['/uploads/products/3fde6e03-c8c8-495d-9698-94fe1cae6f37.jpg'], '50Grms', 81.00, 71.00, 40, 5, 'active', true, true),
        ('1a9b98b2-0629-4cac-9318-c2c65107989d', 'Fresh Onion', 'fresh-onion', '8e8bbc30-1625-4f6b-8b5f-6c33ae7501cd', 'Locally grown crisp and flavorful onions', ARRAY['/uploads/products/0d811c27-2289-4ab1-98a9-e244529e039c.jpg'], '1Kg', 50.00, 50.00, 40, 5, 'active', true, false),
        ('52bf6893-9533-495d-b1db-6621b568f666', 'Organically Grown Coriander Leaves', 'organically-grown-coriander-leaves', '8e8bbc30-1625-4f6b-8b5f-6c33ae7501cd', 'Fresh and aromatic organically grown coriander', ARRAY['/uploads/products/45d16aa7-365d-425f-8180-dc1237bbfe20.jpg'], '100grms', 45.00, 30.00, 40, 5, 'active', true, false),
        ('378716d3-0609-4c9f-90b1-b5dc2eb6dbc6', 'Potato', 'potato', '8e8bbc30-1625-4f6b-8b5f-6c33ae7501cd', 'Farm-fresh premium quality organic potatoes', ARRAY['/uploads/products/57ba83f7-4556-49cb-9bdf-ff77b63be99a.jpg'], '1kg', 60.00, 55.00, 40, 5, 'active', true, false),
        ('7720acc5-22d6-4cbb-be3d-334d823dccca', 'Carrot Local', 'carrot-local', '8e8bbc30-1625-4f6b-8b5f-6c33ae7501cd', 'Sweet and crunchy locally harvested carrots', ARRAY['/uploads/products/5a3e8a3b-9bdf-4350-b461-c481dc76e502.jpg'], '250grms', 52.00, 30.00, 40, 5, 'active', true, false)
        ON CONFLICT (slug) DO UPDATE SET
          category_id = EXCLUDED.category_id,
          selling_price = EXCLUDED.selling_price,
          mrp = EXCLUDED.mrp,
          stock_quantity = EXCLUDED.stock_quantity,
          unit = EXCLUDED.unit,
          images = EXCLUDED.images,
          description = EXCLUDED.description,
          status = 'active';
      `);
      console.log('✅ [AutoMigrate] Category "Fresh" and 6 admin products (Tomato, Lady Finger, Fresh Onion, Coriander, Potato, Carrot) verified and synced.');
    } catch (prodErr: any) {
      console.warn('⚠️ [AutoMigrate] Product/Category sync note:', prodErr.message);
    }

    // 5. Ensure production super admin user exists
    try {
      const sravanHash = '$2b$10$fN7C1aZpT7qefZRzrnjWouSTAmq/uJyNKfXcVIcUjXWYt7D4f.uY6';
      await client.query(`
        INSERT INTO admins (name, email, password, role, status)
        VALUES ('Sravan Kumar', 'naredlasravankumar29@gmail.com', $1, 'super_admin', 'active')
        ON CONFLICT (email) 
        DO UPDATE SET password = $1, role = 'super_admin', status = 'active';
      `, [sravanHash]);
      console.log('✅ [AutoMigrate] Production admin user (naredlasravankumar29@gmail.com) verified/upserted.');
    } catch (adminErr: any) {
      console.warn('⚠️ [AutoMigrate] Admin user upsert note:', adminErr.message);
    }

    console.log('🎉 [AutoMigrate] PostgreSQL database schema is fully initialized and up-to-date!');
  } catch (err: any) {
    console.warn(`⚠️ [AutoMigrate] Database auto-migration note: ${err.message}`);
  } finally {
    if (client) client.release();
    await pool.end().catch(() => {});
  }
}
