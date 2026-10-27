import { Client } from 'pg';
import { env } from './config/env';

async function initPostgres() {
  console.log('🔍 Checking PostgreSQL server connectivity...');

  // 1. Connect to root 'postgres' database
  const rootClient = new Client({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: 'postgres',
    connectionTimeoutMillis: 5000,
  });

  try {
    await rootClient.connect();
    console.log('✅ Connected to PostgreSQL server as superuser.');
  } catch (err: any) {
    console.error('❌ Could not connect to PostgreSQL server on port ' + env.DB_PORT);
    console.error(`   ${err.message}`);
    process.exit(1);
  }

  // 2. Check if 'fresh_vegetables' database exists
  try {
    const checkRes = await rootClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [env.DB_NAME]
    );

    if (checkRes.rows.length === 0) {
      console.log(`📦 Database "${env.DB_NAME}" does not exist. Creating...`);
      await rootClient.query(`CREATE DATABASE "${env.DB_NAME}"`);
      console.log(`✅ Database "${env.DB_NAME}" created successfully!`);
    } else {
      console.log(`✅ Database "${env.DB_NAME}" already exists.`);
    }
  } catch (err: any) {
    console.error('❌ Error creating database:', err.message);
  } finally {
    await rootClient.end();
  }

  // 3. Connect to the fresh_vegetables database
  const appClient = new Client({
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });

  try {
    await appClient.connect();
    const verRes = await appClient.query('SELECT current_database(), version()');
    console.log(`✅ Verified target database: ${verRes.rows[0].current_database}`);
    console.log(`ℹ️  PostgreSQL Version: ${verRes.rows[0].version}`);
    await appClient.end();
    console.log('🎉 PostgreSQL is ready for migrations!');
    process.exit(0);
  } catch (err: any) {
    console.error(`❌ Could not connect to database "${env.DB_NAME}":`, err.message);
    process.exit(1);
  }
}

initPostgres();
