import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { env } from './config/env';

async function runSeed() {
  console.log('🌱 Initializing PostgreSQL database seed runner...');
  const seedPath = path.resolve(__dirname, '../../database/seed/seed.sql');

  if (!fs.existsSync(seedPath)) {
    console.error(`❌ Seed file not found at ${seedPath}`);
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 3000,
  });

  let client;
  try {
    client = await pool.connect();
    console.log(`✅ Connected to real PostgreSQL for seeding: ${env.DB_NAME}`);
  } catch (err: any) {
    console.error('❌ Cannot run seed: PostgreSQL is not reachable.');
    console.error(`   Code: ${err.code || 'UNKNOWN'}`);
    console.error(`   Message: ${err.message}`);
    console.error('   Please start your PostgreSQL service and verify that the database exists before seeding.');
    await pool.end();
    process.exit(1);
  }

  const sql = fs.readFileSync(seedPath, 'utf8');

  try {
    await client.query(sql);
    console.log('✅ PostgreSQL database seeded successfully!');
    client.release();
    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Seeding failed:', error.message);
    if (client) client.release();
    await pool.end();
    process.exit(1);
  }
}

runSeed();
