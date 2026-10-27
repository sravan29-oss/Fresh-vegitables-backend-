import bcrypt from 'bcrypt';
import db from './config/database';

async function updateAdminPassword() {
  try {
    const hash = await bcrypt.hash('admin123', 10);
    const result = await db.query(
      `UPDATE admins SET password = $1 WHERE email IN ('admin@freshveggies.com', 'admin@freshvegetables.com') RETURNING email, name, role`,
      [hash]
    );
    console.log('✅ Admin passwords updated successfully:', result.rows);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error updating admin password:', err);
    process.exit(1);
  }
}

updateAdminPassword();
