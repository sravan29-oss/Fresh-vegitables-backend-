import { Request, Response, NextFunction } from 'express';
import db from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { NotFoundError } from '../utils/appError';

export async function getAddresses(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    let result = await db.query(
      'SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC',
      [req.user!.id]
    );

    if (result.rows.length === 0 && (req.user?.role === 'admin' || req.user?.role === 'super_admin')) {
      result = await db.query(
        'SELECT * FROM addresses ORDER BY is_default DESC, created_at DESC LIMIT 5'
      );
    }

    sendSuccess(res, 'Addresses fetched', result.rows);
  } catch (error) {
    next(error);
  }
}

export async function createAddress(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { full_name, phone, house_number, street, area, landmark, city, state, pincode,
            latitude, longitude, address_type, is_default } = req.body;

    // If setting as default, unset others
    if (is_default) {
      await db.query('UPDATE addresses SET is_default = false WHERE user_id = $1', [userId]);
    }

    // If first address, make it default
    const countResult = await db.query('SELECT COUNT(*)::int as count FROM addresses WHERE user_id = $1', [userId]);
    const makeDefault = is_default || countResult.rows[0].count === 0;

    // Auto-resolve coordinates if missing for known hub service area
    let lat = latitude ? Number(latitude) : null;
    let lng = longitude ? Number(longitude) : null;

    if (lat === null || lng === null) {
      const addrText = `${house_number || ''} ${street || ''} ${area || ''} ${landmark || ''} ${city || ''}`.toLowerCase();
      const isLocalArea =
        String(pincode || '').trim() === '500059' ||
        addrText.includes('champapet') ||
        addrText.includes('rajireddy') ||
        addrText.includes('raji reddy') ||
        addrText.includes('saroornagar') ||
        addrText.includes('saidabad') ||
        addrText.includes('santoshnagar') ||
        addrText.includes('karmanghat');

      if (isLocalArea) {
        lat = 17.347145;
        lng = 78.512947;
      }
    }

    const result = await db.query(
      `INSERT INTO addresses (user_id, full_name, phone, house_number, street, area, landmark,
       city, state, pincode, latitude, longitude, address_type, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [userId, full_name, phone, house_number || null, street || null, area, landmark || null,
       city, state, pincode, lat, lng, address_type, makeDefault]
    );

    sendSuccess(res, 'Address created', result.rows[0], 201);
  } catch (error) {
    next(error);
  }
}

export async function updateAddress(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const existing = await db.query('SELECT * FROM addresses WHERE id = $1 AND user_id = $2', [id, userId]);
    if (existing.rows.length === 0) throw new NotFoundError('Address not found');

    const { full_name, phone, house_number, street, area, landmark, city, state, pincode,
            latitude, longitude, address_type, is_default } = req.body;

    if (is_default) {
      await db.query('UPDATE addresses SET is_default = false WHERE user_id = $1', [userId]);
    }

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    let lat = latitude !== undefined ? latitude : existing.rows[0].latitude;
    let lng = longitude !== undefined ? longitude : existing.rows[0].longitude;
    const pin = pincode || existing.rows[0].pincode;
    const addrArea = area || existing.rows[0].area;
    const addrHouse = house_number || existing.rows[0].house_number;
    if (lat === null || lng === null) {
      const addrText = `${addrHouse || ''} ${addrArea || ''}`.toLowerCase();
      if (String(pin || '').trim() === '500059' || addrText.includes('champapet') || addrText.includes('rajireddy') || addrText.includes('raji reddy')) {
        lat = 17.347145;
        lng = 78.512947;
      }
    }

    const fieldMap: Record<string, any> = {
      full_name, phone, house_number, street, area, landmark, city, state, pincode,
      latitude: lat, longitude: lng, address_type, is_default
    };

    for (const [key, value] of Object.entries(fieldMap)) {
      if (value !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      return sendSuccess(res, 'No changes', existing.rows[0]);
    }

    values.push(id, userId);
    const result = await db.query(
      `UPDATE addresses SET ${fields.join(', ')} WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`,
      values
    );

    sendSuccess(res, 'Address updated', result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function deleteAddress(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) throw new NotFoundError('Address not found');

    sendSuccess(res, 'Address deleted');
  } catch (error) {
    next(error);
  }
}

export async function setDefaultAddress(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const existing = await db.query('SELECT * FROM addresses WHERE id = $1 AND user_id = $2', [id, userId]);
    if (existing.rows.length === 0) throw new NotFoundError('Address not found');

    await db.query('UPDATE addresses SET is_default = false WHERE user_id = $1', [userId]);
    await db.query('UPDATE addresses SET is_default = true WHERE id = $1', [id]);

    sendSuccess(res, 'Default address updated');
  } catch (error) {
    next(error);
  }
}
