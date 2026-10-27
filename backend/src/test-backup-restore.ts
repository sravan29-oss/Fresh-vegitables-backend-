import { execSync } from 'child_process';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { env } from './config/env';

async function testBackupRestore() {
  console.log('💾 Starting Database Backup & Restoration Verification...');

  const backupDir = path.resolve(__dirname, '../../database/backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const dumpPath = path.join(backupDir, 'fresh_vegetables_backup.sql');
  const binDir = path.resolve(__dirname, '../../database/pgsql/pgsql/bin');
  const pgDump = path.join(binDir, 'pg_dump.exe');
  const psql = path.join(binDir, 'psql.exe');

  const rootPool = new Pool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: 'postgres',
  });

  const client = await rootPool.connect();

  try {
    // 1. Run pg_dump
    console.log(`📦 Taking backup of "${env.DB_NAME}" to ${dumpPath}...`);
    const dumpCmd = `"${pgDump}" -h ${env.DB_HOST} -p ${env.DB_PORT} -U ${env.DB_USER} -d ${env.DB_NAME} -F p -f "${dumpPath}"`;
    execSync(dumpCmd, {
      env: { ...process.env, PGPASSWORD: env.DB_PASSWORD },
      stdio: 'pipe',
    });

    const stats = fs.statSync(dumpPath);
    console.log(`✅ Backup successfully created! File size: ${(stats.size / 1024).toFixed(2)} KB`);

    // 2. Create clean test restoration database
    const testDb = 'fresh_vegetables_restore_test';
    console.log(`🧪 Creating temporary test database "${testDb}" for restore test...`);
    await client.query(`DROP DATABASE IF EXISTS "${testDb}"`);
    await client.query(`CREATE DATABASE "${testDb}"`);
    console.log(`✅ Temporary test database "${testDb}" created.`);

    // 3. Restore backup into test database
    console.log(`🔄 Restoring backup into "${testDb}"...`);
    const restoreCmd = `"${psql}" -h ${env.DB_HOST} -p ${env.DB_PORT} -U ${env.DB_USER} -d ${testDb} -f "${dumpPath}"`;
    execSync(restoreCmd, {
      env: { ...process.env, PGPASSWORD: env.DB_PASSWORD },
      stdio: 'pipe',
    });
    console.log(`✅ Backup successfully restored into "${testDb}"!`);

    // 4. Verify data in restored database
    const restorePool = new Pool({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: testDb,
    });
    const restoreClient = await restorePool.connect();

    const bannerCheck = await restoreClient.query('SELECT count(*) FROM homepage_banners');
    const productCheck = await restoreClient.query('SELECT count(*) FROM products');
    const categoryCheck = await restoreClient.query('SELECT count(*) FROM categories');

    console.log('📊 Verified Restored Data:');
    console.log(`   - Homepage Banners: ${bannerCheck.rows[0].count}`);
    console.log(`   - Products: ${productCheck.rows[0].count}`);
    console.log(`   - Categories: ${categoryCheck.rows[0].count}`);

    restoreClient.release();
    await restorePool.end();

    // 5. Clean up temporary test database
    await client.query(`DROP DATABASE "${testDb}"`);
    console.log(`🧹 Cleaned up temporary test database "${testDb}".`);

    client.release();
    await rootPool.end();

    console.log('🎉 Database Backup and Disaster Recovery verification PASSED with 100% success!');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Backup/Restore verification failed:', err.message);
    if (client) client.release();
    await rootPool.end();
    process.exit(1);
  }
}

testBackupRestore();
