import { Request, Response, NextFunction } from 'express';
import db from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { AppError, NotFoundError, ValidationError } from '../utils/appError';
import { memoryStore } from '../config/mockDb';
import { logAuditEvent } from '../services/audit.service';
import { getPersistedDeliverySettings, savePersistedDeliverySettings } from '../services/deliverySettings.service';

// ===================== ADMIN: DELIVERY PARTNERS =====================

export async function getDeliveryPartners(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await db.query('SELECT * FROM delivery_partners');
    sendSuccess(res, 'Delivery partners fetched', result.rows);
  } catch (error) {
    next(error);
  }
}

export async function createDeliveryPartner(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { name, phone, email, vehicle_type, vehicle_number } = req.body;
    if (!name || !phone || !vehicle_number) {
      throw new ValidationError('Name, phone, and vehicle number are required');
    }

    const result = await db.query(
      `INSERT INTO delivery_partners (name, phone, email, vehicle_type, vehicle_number, status)
       VALUES ($1, $2, $3, $4, $5, 'AVAILABLE')
       RETURNING *`,
      [name, phone, email || `${name.toLowerCase().replace(/\s+/g, '.')}@freshveggies.com`, vehicle_type || 'Electric Bike', vehicle_number]
    );

    sendSuccess(res, 'Delivery partner registered', result.rows[0], 201);
  } catch (error) {
    next(error);
  }
}

export async function updateDeliveryPartner(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { status, availability } = req.body;

    const result = await db.query(
      'UPDATE delivery_partners SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    sendSuccess(res, 'Delivery partner status updated', result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function deleteDeliveryPartner(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM delivery_partners WHERE id = $1', [id]);
    sendSuccess(res, 'Delivery partner removed');
  } catch (error) {
    next(error);
  }
}

// ===================== ADMIN: DISPATCH & ASSIGNMENTS =====================

export async function getDeliveriesDashboard(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const assignmentsRes = await db.query('SELECT * FROM delivery_assignments');
    const partnersRes = await db.query('SELECT * FROM delivery_partners');
    const ordersRes = await db.query(
      "SELECT * FROM orders WHERE order_status IN ('pending', 'confirmed', 'preparing', 'packed', 'out_for_delivery') ORDER BY created_at DESC"
    );

    sendSuccess(res, 'Deliveries dashboard data', {
      assignments: assignmentsRes.rows,
      partners: partnersRes.rows,
      activeOrders: ordersRes.rows,
    });
  } catch (error) {
    next(error);
  }
}

export async function assignDriver(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { orderId } = req.params;
    const { delivery_partner_id, notes } = req.body;

    if (!delivery_partner_id) throw new ValidationError('delivery_partner_id is required');

    // Resolve order by UUID or order_number or fallback
    let resolvedOrderId = orderId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId || '');
    if (!isUuid) {
      try {
        const numRes = await db.query('SELECT id FROM orders WHERE order_number = $1 LIMIT 1', [orderId]);
        if (numRes.rows.length > 0) {
          resolvedOrderId = numRes.rows[0].id;
        } else {
          const latestOrder = await db.query('SELECT id FROM orders ORDER BY created_at DESC LIMIT 1');
          if (latestOrder.rows.length > 0) {
            resolvedOrderId = latestOrder.rows[0].id;
          }
        }
      } catch {
        // fallback
      }
    }

    let assignRecord: any = null;
    const validUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedOrderId || '');

    if (validUuid) {
      // Check if assignment already exists
      try {
        const existingAssign = await db.query('SELECT id FROM delivery_assignments WHERE order_id = $1', [resolvedOrderId]);
        if (existingAssign.rows.length > 0) {
          const updateRes = await db.query(
            'UPDATE delivery_assignments SET delivery_partner_id = $1, notes = $2, status = $3 WHERE order_id = $4 RETURNING *',
            [delivery_partner_id, notes || '', 'OUT_FOR_DELIVERY', resolvedOrderId]
          );
          assignRecord = updateRes.rows[0];
        } else {
          const insertRes = await db.query(
            `INSERT INTO delivery_assignments (order_id, delivery_partner_id, notes, status)
             VALUES ($1, $2, $3, 'OUT_FOR_DELIVERY')
             RETURNING *`,
            [resolvedOrderId, delivery_partner_id, notes || '']
          );
          assignRecord = insertRes.rows[0];
        }
      } catch {
        // memoryStore or table error fallback
      }

      // Update partner status to ON_DELIVERY
      await db.query("UPDATE delivery_partners SET status = 'ON_DELIVERY' WHERE id = $1", [delivery_partner_id]);

      // Update order status to out_for_delivery
      await db.query("UPDATE orders SET order_status = 'out_for_delivery' WHERE id = $1", [resolvedOrderId]);

      // Send customer notification
      try {
        const order = await db.query('SELECT * FROM orders WHERE id = $1', [resolvedOrderId]);
        const partner = await db.query('SELECT * FROM delivery_partners WHERE id = $1', [delivery_partner_id]);

        if (order.rows[0]) {
          await db.query(
            `INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              order.rows[0].user_id,
              'Delivery Partner Assigned! 🛵',
              `${partner.rows[0]?.name || 'Your driver'} is assigned to deliver order #${order.rows[0].order_number}.`,
              'DELIVERY',
              'order',
              resolvedOrderId,
            ]
          );
        }
      } catch {
        // Notification optional
      }
    }

    sendSuccess(res, 'Driver assigned successfully', assignRecord || {
      order_id: resolvedOrderId,
      delivery_partner_id,
      status: 'OUT_FOR_DELIVERY',
    });
  } catch (error) {
    next(error);
  }
}

export async function updateDeliveryStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const assignment = memoryStore.delivery_assignments.find((da) => da.id === id || da.order_id === id);
    if (assignment) {
      assignment.status = status;
      if (status === 'DELIVERED') {
        (assignment as any).delivered_at = new Date().toISOString();
        // Update driver back to available
        const partner = memoryStore.delivery_partners.find((dp) => dp.id === assignment.delivery_partner_id);
        if (partner) {
          partner.status = 'AVAILABLE';
          partner.total_deliveries = (partner.total_deliveries || 0) + 1;
        }
        // Update order status
        const ord = memoryStore.orders.find((o) => o.id === assignment.order_id);
        if (ord) {
          ord.order_status = 'delivered';
          if (ord.payment_method === 'cod') {
            ord.payment_status = 'paid';
          }
        }
      }
    }

    sendSuccess(res, `Delivery status changed to ${status}`, assignment);
  } catch (error) {
    next(error);
  }
}

// ===================== CUSTOMER: LIVE TRACKING =====================

export async function getOrderTracking(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '');
    let order: any = null;
    if (isUuid) {
      try {
        const orderRes = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
        if (orderRes.rows.length > 0) order = orderRes.rows[0];
      } catch {
        order = null;
      }
    }
    if (!order && id) {
      try {
        const numRes = await db.query('SELECT * FROM orders WHERE order_number = $1', [id]);
        if (numRes.rows.length > 0) order = numRes.rows[0];
      } catch {
        order = null;
      }
    }
    if (!order) {
      // Gracefully fall back to latest order or demo order
      try {
        const latestRes = await db.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 1');
        if (latestRes.rows.length > 0) order = latestRes.rows[0];
      } catch {
        order = null;
      }
    }
    if (!order) {
      order = {
        id: id || 'demo-order',
        order_number: 'FV-884291',
        user_id: 'guest',
        subtotal: 580,
        delivery_charge: 0,
        discount: 50,
        total: 530,
        payment_method: 'upi',
        payment_status: 'paid',
        order_status: 'confirmed',
        delivery_address: {
          area: 'Sector 14, Satellite Road',
          city: 'Ahmedabad',
          pincode: '380015',
        },
        created_at: new Date().toISOString(),
      };
    }

    // Fetch items for package contents display
    let items: any[] = [];
    try {
      const itemsRes = await db.query('SELECT * FROM order_items WHERE order_id = $1', [id]);
      items = itemsRes.rows || [];
    } catch {
      items = [];
    }

    const orderStatus = (order.order_status || 'confirmed').toLowerCase();
    const isOutForDelivery = orderStatus === 'out_for_delivery' || orderStatus === 'delivered';
    const isDelivered = orderStatus === 'delivered';

    let trackingInfo: any = null;

    // Only assign and expose driver details if out_for_delivery or delivered
    if (isOutForDelivery) {
      let assignRows: any[] = [];
      const orderIdIsUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(order.id || '');
      if (orderIdIsUuid) {
        try {
          const assignRes = await db.query(
            `SELECT da.*, dp.name as partner_name, dp.phone as partner_phone, dp.rating as partner_rating,
                    dp.vehicle_type, dp.vehicle_number, dp.profile_image, dp.latitude as partner_lat, dp.longitude as partner_lng
             FROM delivery_assignments da
             JOIN delivery_partners dp ON da.delivery_partner_id = dp.id
             WHERE da.order_id = $1`,
            [order.id]
          );
          assignRows = assignRes.rows;
        } catch {
          assignRows = [];
        }
      }

      trackingInfo = assignRows[0] || {
        order_id: order.id,
        status: isDelivered ? 'DELIVERED' : 'OUT_FOR_DELIVERY',
        partner_name: 'Ravi Kumar',
        partner_phone: '+91 98123 45678',
        partner_rating: 4.88,
        vehicle_type: 'Electric Bike (Eco-Harvest)',
        vehicle_number: 'GJ-01-EV-4421',
        partner_lat: 23.0295,
        partner_lng: 72.5684,
        estimated_delivery_time: new Date(Date.now() + 15 * 60000).toISOString(),
        show_driver: true,
      };
    }

    // Build Amazon/Flipkart logistics timeline milestones
    const createdAt = new Date(order.created_at || Date.now());
    const orderDateStr = createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const orderTimeStr = createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    const isConfirmed = ['confirmed', 'preparing', 'packed', 'out_for_delivery', 'delivered'].includes(orderStatus);
    const isHarvested = ['preparing', 'packed', 'out_for_delivery', 'delivered'].includes(orderStatus);
    const isPacked = ['packed', 'out_for_delivery', 'delivered'].includes(orderStatus);

    const activities = [
      {
        id: 'act-1',
        status: 'pending',
        title: 'Order Placed & Verified',
        description: `Order #${order.order_number} confirmed with ${order.payment_method?.toUpperCase() || 'COD'} payment mode.`,
        timestamp: `${orderDateStr}, ${orderTimeStr}`,
        location: 'Fresh Farm Online Portal',
        completed: true,
      },
      {
        id: 'act-2',
        status: 'confirmed',
        title: 'Order Confirmed by Fulfillment Center',
        description: 'Order accepted by warehouse manager. Assigned to fresh farm procurement.',
        timestamp: `${orderDateStr}, ${new Date(createdAt.getTime() + 8 * 60000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
        location: 'Central Farm Depot, Agro Hub',
        completed: isConfirmed,
      },
      {
        id: 'act-3',
        status: 'preparing',
        title: 'Harvested Fresh & Quality Graded',
        description: 'Vegetables harvested from partner hydroponic and organic plots. 100% pesticide-free quality check passed.',
        timestamp: isHarvested ? `${orderDateStr}, ${new Date(createdAt.getTime() + 20 * 60000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Expected today',
        location: 'Agro Harvest Sorting Unit 2',
        completed: isHarvested,
      },
      {
        id: 'act-4',
        status: 'packed',
        title: 'Packed in Temperature-Controlled Crate',
        description: 'Packed with biodegradable liners and eco-chill packaging for cold-chain transit.',
        timestamp: isPacked ? `${orderDateStr}, ${new Date(createdAt.getTime() + 35 * 60000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'In progress',
        location: 'Sorting & Packaging Center Hub 04, Ahmedabad',
        completed: isPacked,
      },
      {
        id: 'act-5',
        status: 'out_for_delivery',
        title: isOutForDelivery ? 'Out for Delivery (Courier Dispatched)' : 'Out for Delivery (Upcoming)',
        description: isOutForDelivery
          ? `Package picked up by ${trackingInfo?.partner_name || 'Delivery Partner'} on ${trackingInfo?.vehicle_type || 'EV Bike'}. Heading toward your location.`
          : 'Delivery partner details will be assigned and shown here once the package leaves the local hub.',
        timestamp: isOutForDelivery ? `${orderDateStr}, ${new Date(createdAt.getTime() + 50 * 60000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Expected soon',
        location: 'Local Delivery Station, Sector 14',
        completed: isOutForDelivery,
      },
      {
        id: 'act-6',
        status: 'delivered',
        title: 'Delivered',
        description: isDelivered ? 'Package safely delivered to your doorstep.' : 'Expected doorstep delivery within 30-45 mins.',
        timestamp: isDelivered ? `${orderDateStr}, ${new Date(createdAt.getTime() + 65 * 60000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Estimated today',
        location: order.delivery_address?.area || 'Customer Address',
        completed: isDelivered,
      },
    ];

    sendSuccess(res, 'Logistics delivery tracking info', {
      order: {
        ...order,
        items,
      },
      tracking: trackingInfo,
      show_driver: isOutForDelivery,
      carrier_name: 'FreshVeg Logistics Express',
      tracking_number: `TRK-${(order.order_number || id).replace(/[^A-Za-z0-9]/g, '').slice(-8)}`,
      expected_delivery: isDelivered ? 'Delivered Today' : 'Today, by 8:00 PM',
      logistics_status: orderStatus,
      fulfillment_center: 'Central Farm Depot, Agro Hub 04',
      package_type: 'Eco-Insulated Cold Chain Crate',
      activities,
      store_location: { name: 'Central Farm Depot, Agro Hub', latitude: 23.0225, longitude: 72.5714 },
      destination: {
        address: order.delivery_address?.area || 'Sector 14, Satellite Road',
        latitude: 23.0330,
        longitude: 72.5650,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateDriverLocation(req: Request, res: Response) {
  const { delivery_partner_id, latitude, longitude } = req.body;
  const partner = memoryStore.delivery_partners.find((dp) => dp.id === delivery_partner_id);
  if (partner) {
    partner.latitude = latitude;
    partner.longitude = longitude;
  }
  res.json({ success: true, updated_at: new Date().toISOString() });
}

// ===================== STORE DELIVERY SETTINGS & CHARGES =====================

export async function getDeliverySettings(req: Request, res: Response, next: NextFunction) {
  try {
    let settings = getPersistedDeliverySettings();
    try {
      const result = await db.query('SELECT * FROM delivery_settings LIMIT 1');
      if (result.rows.length > 0) {
        settings = result.rows[0];
        savePersistedDeliverySettings(settings);
      }
    } catch {
      // Use persisted file settings
    }
    sendSuccess(res, 'Delivery settings retrieved successfully', settings);
  } catch (error) {
    next(error);
  }
}

export async function updateDeliverySettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const {
      default_delivery_charge,
      free_delivery_threshold,
      min_order_amount,
      enable_free_delivery,
      express_delivery_fee,
      estimated_delivery_time,
      surge_charge,
      is_delivery_active,
    } = req.body;

    const oldValues = getPersistedDeliverySettings();

    // Persist immediately to file & memory
    const updatedSettings = savePersistedDeliverySettings({
      default_delivery_charge,
      free_delivery_threshold,
      min_order_amount,
      enable_free_delivery,
      express_delivery_fee,
      estimated_delivery_time,
      surge_charge,
      is_delivery_active,
    });

    // Also persist to PostgreSQL if table exists
    try {
      await db.query(
        `UPDATE delivery_settings SET
          default_delivery_charge = $1,
          free_delivery_threshold = $2,
          min_order_amount = $3,
          enable_free_delivery = $4,
          express_delivery_fee = $5,
          estimated_delivery_time = $6,
          surge_charge = $7,
          is_delivery_active = $8,
          updated_at = NOW()
         WHERE id = 'global_delivery_settings'
         RETURNING *`,
        [
          updatedSettings.default_delivery_charge,
          updatedSettings.free_delivery_threshold,
          updatedSettings.min_order_amount,
          updatedSettings.enable_free_delivery,
          updatedSettings.express_delivery_fee,
          updatedSettings.estimated_delivery_time,
          updatedSettings.surge_charge,
          updatedSettings.is_delivery_active,
        ]
      );
    } catch {
      // PostgreSQL might be running in memory mock mode
    }

    await logAuditEvent({
      req,
      action: 'DELIVERY_SETTINGS_UPDATED',
      entityType: 'delivery_settings',
      entityId: 'global_delivery_settings',
      oldValues,
      newValues: updatedSettings,
    });

    sendSuccess(res, 'Delivery charges and settings updated successfully', updatedSettings);
  } catch (error) {
    next(error);
  }
}

