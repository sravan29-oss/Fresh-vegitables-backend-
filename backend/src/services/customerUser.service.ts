import db from '../config/database';

export interface AuthUserPayload {
  id: string;
  email?: string;
  mobile?: string;
  name?: string;
  role?: string;
}

/**
 * Resolves a valid PostgreSQL users.id for any authenticated caller.
 * Guarantees that foreign key constraints referencing users(id)
 * (such as carts.user_id, orders.user_id, customer_addresses.user_id, wallet.user_id)
 * will NEVER fail with a 23503 foreign key violation ("Referenced record does not exist").
 */
export async function resolveCustomerUserId(authUser: AuthUserPayload): Promise<string> {
  if (!authUser || !authUser.id) {
    throw new Error('Authentication required');
  }

  // 1. Check if authUser.id already exists directly in users table
  try {
    const directRes = await db.query('SELECT id FROM users WHERE id = $1', [authUser.id]);
    if (directRes.rows.length > 0) {
      return directRes.rows[0].id;
    }
  } catch (err) {
    console.warn('[customerUser.service] Error checking direct user id:', err);
  }

  // 2. If caller is an admin or external account, check for an existing customer profile matching email or mobile
  const email = authUser.email ? authUser.email.trim().toLowerCase() : null;
  const mobile = authUser.mobile ? authUser.mobile.trim() : null;

  if (email || mobile) {
    try {
      const matchRes = await db.query(
        `SELECT id FROM users 
         WHERE ($1::text IS NOT NULL AND LOWER(email) = $1::text) 
            OR ($2::text IS NOT NULL AND mobile = $2::text)
         LIMIT 1`,
        [email, mobile]
      );
      if (matchRes.rows.length > 0) {
        return matchRes.rows[0].id;
      }
    } catch (err) {
      console.warn('[customerUser.service] Error matching user by email/mobile:', err);
    }
  }

  // 3. If no customer record exists, automatically create a linked customer profile in users table
  const userName = authUser.name || (email ? email.split('@')[0] : 'Customer');
  const fallbackPasswordHash = '$2b$10$e8W/2s13L7F.X5P0kK2v9.yP21cQhE0s3v3N2X4C7G9J1L8M3N5Q';
  try {
    const createdRes = await db.query(
      `INSERT INTO users (name, email, mobile, password, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id`,
      [userName, email, mobile, fallbackPasswordHash]
    );
    return createdRes.rows[0].id;
  } catch (insertErr: any) {
    // If unique constraint hit on concurrent insert, re-query existing
    if (insertErr.code === '23505') {
      const fallbackRes = await db.query(
        `SELECT id FROM users 
         WHERE ($1::text IS NOT NULL AND LOWER(email) = $1::text) 
            OR ($2::text IS NOT NULL AND mobile = $2::text)
         LIMIT 1`,
        [email, mobile]
      );
      if (fallbackRes.rows.length > 0) {
        return fallbackRes.rows[0].id;
      }
    }
    console.error('[customerUser.service] Failed to create linked user:', insertErr);
    throw insertErr;
  }
}

