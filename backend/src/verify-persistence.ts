import { Pool } from 'pg';
import { env } from './config/env';
import { v4 as uuidv4 } from 'uuid';

async function verifyPersistence() {
  console.log('🧪 Starting Phase 13 PostgreSQL Persistence Verification...');

  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 3000,
  });

  let client;
  try {
    client = await pool.connect();
    const dbInfo = await client.query('SELECT current_database(), current_user, version()');
    console.log(`✅ Connected directly to PostgreSQL database: "${dbInfo.rows[0].current_database}" as user: "${dbInfo.rows[0].current_user}"`);
  } catch (err: any) {
    console.error('❌ Cannot verify persistence: PostgreSQL is not reachable.');
    console.error(`   ${err.message}`);
    await pool.end();
    process.exit(1);
  }

  try {
    // 1. Check sections table
    const secRes = await client.query('SELECT count(*) FROM homepage_sections');
    console.log(`📊 Current homepage_sections in PostgreSQL: ${secRes.rows[0].count}`);

    // Ensure at least one section exists
    let sectionId;
    const findSec = await client.query("SELECT id FROM homepage_sections WHERE type = 'hero_banner' LIMIT 1");
    if (findSec.rows.length > 0) {
      sectionId = findSec.rows[0].id;
    } else {
      const newSecId = uuidv4();
      await client.query(`
        INSERT INTO homepage_sections (id, type, title, subtitle, display_order, status)
        VALUES ($1, 'hero_banner', 'Main Hero Showcase', 'Seasonal Organics', 0, 'active')
      `, [newSecId]);
      sectionId = newSecId;
      console.log(`✅ Inserted base hero_banner section into PostgreSQL: ${sectionId}`);
    }

    // 2. Insert test banner
    const bannerId = uuidv4();
    const bannerTitle = `Persistence Verification Banner ${Date.now()}`;
    await client.query(`
      INSERT INTO homepage_banners (id, section_id, title, subtitle, image, link, badge, display_order, status)
      VALUES ($1, $2, $3, 'Verified Real PostgreSQL Storage', 'https://images.unsplash.com/photo-1540420773420-3366772f4999', '/shop', 'VERIFIED', 99, 'active')
    `, [bannerId, sectionId, bannerTitle]);
    console.log(`✅ Created test banner in PostgreSQL: "${bannerTitle}" (ID: ${bannerId})`);

    // 3. Query PostgreSQL directly to verify record is physically stored
    const verifyRes = await client.query('SELECT id, title, badge, status, created_at FROM homepage_banners WHERE id = $1', [bannerId]);
    if (verifyRes.rows.length === 1 && verifyRes.rows[0].title === bannerTitle) {
      console.log('🎉 PERSISTENCE CONFIRMED: Record was found in PostgreSQL disk storage!');
      console.log('   Row Data:', JSON.stringify(verifyRes.rows[0], null, 2));
    } else {
      throw new Error('Banner record was not found in PostgreSQL query.');
    }

    // Clean up or keep as verified
    client.release();
    await pool.end();
    console.log('✅ PostgreSQL persistence test completed with 100% success.');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Persistence verification failed:', err.message);
    if (client) client.release();
    await pool.end();
    process.exit(1);
  }
}

verifyPersistence();
