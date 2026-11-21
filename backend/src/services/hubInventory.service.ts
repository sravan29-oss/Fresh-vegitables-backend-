import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';
import { memoryStore } from '../config/mockDb';
import { ValidationError, NotFoundError } from '../utils/appError';
import { getPersistedHubs } from './hubStore.service';

export interface HubInventoryItem {
  id: string;
  hub_id: string;
  hub_name?: string;
  product_id: string;
  product_name: string;
  product_image?: string;
  sku?: string;
  category_name?: string;
  unit: string;
  selling_price: number;
  purchase_price?: number;
  stock_quantity: number;
  reserved_quantity: number;
  available_to_sell: number;
  minimum_stock: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  updated_at: string;
}

export interface InventorySummary {
  total_products: number;
  total_stock: number;
  in_stock: number;
  low_stock: number;
  out_of_stock: number;
  total_inventory_value: number;
}

export interface HubStockMovement {
  id: string;
  hub_id: string;
  product_id: string;
  product_name?: string;
  variant_id?: string | null;
  previous_stock: number;
  new_stock: number;
  quantity_changed: number;
  operation_type: 'ADD' | 'REDUCE' | 'ADJUST' | 'CORRECTION' | 'ORDER_DEDUCT' | 'ORDER_CANCEL_RESTORE' | 'ORDER_FAILED_RESTORE' | 'SEED';
  reason: string;
  reference_type?: string;
  reference_id?: string;
  created_by?: string;
  created_at: string;
}

// In-memory initialization for mock store
export function ensureMockHubInventoryInitialized() {
  if (!memoryStore.hub_inventory) {
    memoryStore.hub_inventory = [];
  }
  if (!memoryStore.hub_inventory_movements) {
    memoryStore.hub_inventory_movements = [];
  }

  if (memoryStore.hub_inventory.length === 0 && memoryStore.products && memoryStore.products.length > 0) {
    const hubs = ['hub-champapet', 'hub-kphb'];
    for (const hubId of hubs) {
      for (const prod of memoryStore.products) {
        const qty = Number(prod.stock_quantity ?? 30);
        const minStock = Number(prod.minimum_stock ?? 5);
        const status = qty <= 0 ? 'out_of_stock' : qty <= minStock ? 'low_stock' : 'in_stock';
        memoryStore.hub_inventory.push({
          id: `hinv_${hubId}_${prod.id}`,
          hub_id: hubId,
          product_id: prod.id,
          variant_id: null,
          stock_quantity: qty,
          reserved_quantity: 0,
          minimum_stock: minStock,
          status,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }
  }
}

// Helper to determine status
export function calculateStockStatus(stock: number, minStock: number): 'in_stock' | 'low_stock' | 'out_of_stock' {
  if (stock <= 0) return 'out_of_stock';
  if (stock <= minStock) return 'low_stock';
  return 'in_stock';
}

/**
 * Fetch inventory for a specific hub, or across all hubs, with KPI summary calculations.
 */
export async function getHubInventory(params: {
  hub_id?: string;
  stock_status?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: HubInventoryItem[]; total: number; summary: InventorySummary }> {
  ensureMockHubInventoryInitialized();
  const hubs = getPersistedHubs();
  const hubMap = new Map(hubs.map((h) => [h.id, h.name]));

  try {
    let whereConditions = ["p.status = 'active'"];
    const queryParams: any[] = [];
    let idx = 1;

    if (params.hub_id && params.hub_id !== 'all') {
      whereConditions.push(`hi.hub_id = $${idx++}`);
      queryParams.push(params.hub_id);
    }

    if (params.search) {
      whereConditions.push(`(p.name ILIKE $${idx} OR p.sku ILIKE $${idx} OR c.name ILIKE $${idx})`);
      queryParams.push(`%${params.search}%`);
      idx++;
    }

    if (params.stock_status === 'out_of_stock') {
      whereConditions.push('COALESCE(hi.stock_quantity, p.stock_quantity) <= 0');
    } else if (params.stock_status === 'low_stock') {
      whereConditions.push('COALESCE(hi.stock_quantity, p.stock_quantity) > 0 AND COALESCE(hi.stock_quantity, p.stock_quantity) <= COALESCE(hi.minimum_stock, p.minimum_stock)');
    } else if (params.stock_status === 'in_stock') {
      whereConditions.push('COALESCE(hi.stock_quantity, p.stock_quantity) > COALESCE(hi.minimum_stock, p.minimum_stock)');
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT
        hi.id,
        COALESCE(hi.hub_id, 'hub-champapet') as hub_id,
        p.id as product_id,
        p.name as product_name,
        p.sku,
        p.images,
        p.unit,
        p.selling_price,
        p.purchase_price,
        COALESCE(hi.stock_quantity, p.stock_quantity, 0) as stock_quantity,
        COALESCE(hi.reserved_quantity, 0) as reserved_quantity,
        COALESCE(hi.minimum_stock, p.minimum_stock, 5) as minimum_stock,
        c.name as category_name,
        hi.updated_at
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN hub_inventory hi ON p.id = hi.product_id ${params.hub_id && params.hub_id !== 'all' ? `AND hi.hub_id = '${params.hub_id}'` : ''}
      ${whereClause}
      ORDER BY p.name ASC
    `;

    const res = await db.query(query, queryParams);
    const rows = res.rows;

    let totalStock = 0;
    let inStock = 0;
    let lowStock = 0;
    let outOfStock = 0;
    let totalValue = 0;

    const items: HubInventoryItem[] = rows.map((r: any) => {
      const stock = Number(r.stock_quantity || 0);
      const reserved = Number(r.reserved_quantity || 0);
      const minStock = Number(r.minimum_stock || 5);
      const price = Number(r.selling_price || 0);
      const cost = Number(r.purchase_price || price * 0.7);
      const status = calculateStockStatus(stock, minStock);

      totalStock += stock;
      totalValue += stock * cost;

      if (status === 'out_of_stock') outOfStock++;
      else if (status === 'low_stock') lowStock++;
      else inStock++;

      const images = Array.isArray(r.images) ? r.images : [];

      return {
        id: r.id || `hinv_${r.hub_id}_${r.product_id}`,
        hub_id: r.hub_id,
        hub_name: hubMap.get(r.hub_id) || (r.hub_id === 'hub-kphb' ? 'Fresh Vegetables KPHB Hub' : 'Fresh Vegetables Champapet Hub'),
        product_id: r.product_id,
        product_name: r.product_name,
        product_image: images[0] || '',
        sku: r.sku || `SKU-${r.product_name.slice(0, 3).toUpperCase()}-${r.product_id.slice(0, 4)}`,
        category_name: r.category_name || 'Fresh',
        unit: r.unit || 'unit',
        selling_price: price,
        purchase_price: cost,
        stock_quantity: stock,
        reserved_quantity: reserved,
        available_to_sell: Math.max(0, stock - reserved),
        minimum_stock: minStock,
        status,
        updated_at: r.updated_at || new Date().toISOString(),
      };
    });

    const summary: InventorySummary = {
      total_products: items.length,
      total_stock: totalStock,
      in_stock: inStock,
      low_stock: lowStock,
      out_of_stock: outOfStock,
      total_inventory_value: Math.round(totalValue * 100) / 100,
    };

    return { items, total: items.length, summary };
  } catch (err) {
    // Memory Store fallback
    let list = [...memoryStore.hub_inventory];

    if (params.hub_id && params.hub_id !== 'all') {
      list = list.filter((i) => i.hub_id === params.hub_id);
    }

    const items: HubInventoryItem[] = list.map((inv) => {
      const prod = memoryStore.products.find((p) => p.id === inv.product_id);
      const stock = Number(inv.stock_quantity || 0);
      const reserved = Number(inv.reserved_quantity || 0);
      const minStock = Number(inv.minimum_stock || 5);
      const status = calculateStockStatus(stock, minStock);
      const price = Number(prod?.selling_price || 30);
      const cost = Number(prod?.purchase_price || price * 0.7);

      return {
        id: inv.id,
        hub_id: inv.hub_id,
        hub_name: hubMap.get(inv.hub_id) || (inv.hub_id === 'hub-kphb' ? 'Fresh Vegetables KPHB Hub' : 'Fresh Vegetables Champapet Hub'),
        product_id: inv.product_id,
        product_name: prod?.name || 'Fresh Produce',
        product_image: prod?.images?.[0] || '',
        sku: prod?.sku || `SKU-${(prod?.name || 'PRD').slice(0, 3).toUpperCase()}`,
        category_name: prod?.category_name || 'Fresh Vegetables',
        unit: prod?.unit || 'unit',
        selling_price: price,
        purchase_price: cost,
        stock_quantity: stock,
        reserved_quantity: reserved,
        available_to_sell: Math.max(0, stock - reserved),
        minimum_stock: minStock,
        status,
        updated_at: inv.updated_at || new Date().toISOString(),
      };
    });

    let filtered = items;
    if (params.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter((i) => i.product_name.toLowerCase().includes(q) || i.category_name?.toLowerCase().includes(q));
    }
    if (params.stock_status) {
      filtered = filtered.filter((i) => i.status === params.stock_status);
    }

    const summary: InventorySummary = {
      total_products: filtered.length,
      total_stock: filtered.reduce((acc, curr) => acc + curr.stock_quantity, 0),
      in_stock: filtered.filter((i) => i.status === 'in_stock').length,
      low_stock: filtered.filter((i) => i.status === 'low_stock').length,
      out_of_stock: filtered.filter((i) => i.status === 'out_of_stock').length,
      total_inventory_value: Math.round(
        filtered.reduce((acc, curr) => acc + curr.stock_quantity * (curr.purchase_price || curr.selling_price * 0.7), 0) * 100
      ) / 100,
    };

    return { items: filtered, total: filtered.length, summary };
  }
}

/**
 * Update stock for a specific hub with audit movement recording.
 */
export async function updateHubStock(params: {
  hub_id: string;
  product_id: string;
  variant_id?: string | null;
  operation: 'ADD' | 'REDUCE' | 'ADJUST' | 'CORRECTION';
  quantity: number;
  reason: string;
  admin_id?: string;
}): Promise<{ inventory: HubInventoryItem; movement: HubStockMovement }> {
  ensureMockHubInventoryInitialized();
  const { hub_id, product_id, variant_id, operation, quantity, reason, admin_id } = params;

  if (!hub_id) throw new ValidationError('Hub ID is required');
  if (!product_id) throw new ValidationError('Product ID is required');

  if (operation === 'CORRECTION' && (!reason || reason.trim().length < 3)) {
    throw new ValidationError('A detailed reason is mandatory for stock corrections');
  }

  const numQty = Number(quantity);
  if (isNaN(numQty)) throw new ValidationError('Valid numeric quantity is required');

  // Fetch current stock
  let currentStock = 0;
  let minStock = 5;

  try {
    const existing = await db.query(
      'SELECT * FROM hub_inventory WHERE hub_id = $1 AND product_id = $2',
      [hub_id, product_id]
    );

    if (existing.rows.length > 0) {
      currentStock = Number(existing.rows[0].stock_quantity || 0);
      minStock = Number(existing.rows[0].minimum_stock || 5);
    } else {
      // Check product default stock
      const prodRes = await db.query('SELECT stock_quantity, minimum_stock FROM products WHERE id = $1', [product_id]);
      if (prodRes.rows.length === 0) throw new NotFoundError('Product not found');
      currentStock = Number(prodRes.rows[0].stock_quantity || 0);
      minStock = Number(prodRes.rows[0].minimum_stock || 5);
    }

    let newStock = currentStock;
    let qtyChanged = 0;

    if (operation === 'ADD') {
      if (numQty <= 0) throw new ValidationError('Addition quantity must be greater than zero');
      newStock = currentStock + numQty;
      qtyChanged = numQty;
    } else if (operation === 'REDUCE') {
      if (numQty <= 0) throw new ValidationError('Reduction quantity must be greater than zero');
      newStock = currentStock - numQty;
      qtyChanged = -numQty;
    } else if (operation === 'ADJUST' || operation === 'CORRECTION') {
      if (numQty < 0) throw new ValidationError('Stock quantity cannot be negative');
      newStock = numQty;
      qtyChanged = newStock - currentStock;
    }

    if (newStock < 0) {
      throw new ValidationError(`Insufficient stock. Current stock is ${currentStock}, cannot reduce by ${numQty}`);
    }

    const newStatus = calculateStockStatus(newStock, minStock);

    const upsertRes = await db.query(
      `INSERT INTO hub_inventory (hub_id, product_id, variant_id, stock_quantity, minimum_stock, status, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (hub_id, product_id) WHERE variant_id IS NULL
       DO UPDATE SET stock_quantity = $4, status = $6, updated_at = NOW()
       RETURNING *`,
      [hub_id, product_id, variant_id || null, newStock, minStock, newStatus]
    );

    const movementId = uuidv4();
    const movRes = await db.query(
      `INSERT INTO hub_inventory_movements (
        id, hub_id, product_id, variant_id, previous_stock, new_stock,
        quantity_changed, operation_type, reason, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *`,
      [movementId, hub_id, product_id, variant_id || null, currentStock, newStock, qtyChanged, operation, reason || 'Manual Admin Update', admin_id || null]
    );

    const hubs = getPersistedHubs();
    const hub = hubs.find((h) => h.id === hub_id);
    const prodRes = await db.query('SELECT name, unit, selling_price FROM products WHERE id = $1', [product_id]);
    const prod = prodRes.rows[0];

    const inventoryItem: HubInventoryItem = {
      id: upsertRes.rows[0].id,
      hub_id,
      hub_name: hub?.name,
      product_id,
      product_name: prod?.name || 'Produce',
      unit: prod?.unit || 'unit',
      selling_price: Number(prod?.selling_price || 0),
      stock_quantity: newStock,
      reserved_quantity: 0,
      available_to_sell: newStock,
      minimum_stock: minStock,
      status: newStatus,
      updated_at: upsertRes.rows[0].updated_at,
    };

    return { inventory: inventoryItem, movement: movRes.rows[0] };
  } catch (err: any) {
    if (err instanceof ValidationError || err instanceof NotFoundError) throw err;

    // Memory Store fallback
    let inv = memoryStore.hub_inventory.find((i) => i.hub_id === hub_id && i.product_id === product_id);
    if (!inv) {
      const prod = memoryStore.products.find((p) => p.id === product_id);
      if (!prod) throw new NotFoundError('Product not found');
      inv = {
        id: `hinv_${hub_id}_${product_id}`,
        hub_id,
        product_id,
        variant_id: null,
        stock_quantity: Number(prod.stock_quantity || 0),
        reserved_quantity: 0,
        minimum_stock: Number(prod.minimum_stock || 5),
        status: 'in_stock',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      memoryStore.hub_inventory.push(inv);
    }

    currentStock = inv.stock_quantity;
    minStock = inv.minimum_stock;

    let newStock = currentStock;
    let qtyChanged = 0;

    if (operation === 'ADD') {
      if (numQty <= 0) throw new ValidationError('Addition quantity must be greater than zero');
      newStock = currentStock + numQty;
      qtyChanged = numQty;
    } else if (operation === 'REDUCE') {
      if (numQty <= 0) throw new ValidationError('Reduction quantity must be greater than zero');
      newStock = currentStock - numQty;
      qtyChanged = -numQty;
    } else if (operation === 'ADJUST' || operation === 'CORRECTION') {
      if (numQty < 0) throw new ValidationError('Stock quantity cannot be negative');
      newStock = numQty;
      qtyChanged = newStock - currentStock;
    }

    if (newStock < 0) {
      throw new ValidationError(`Insufficient stock. Current stock is ${currentStock}, cannot reduce by ${numQty}`);
    }

    inv.stock_quantity = newStock;
    inv.status = calculateStockStatus(newStock, minStock);
    inv.updated_at = new Date().toISOString();

    const movement: HubStockMovement = {
      id: uuidv4(),
      hub_id,
      product_id,
      variant_id: variant_id || null,
      previous_stock: currentStock,
      new_stock: newStock,
      quantity_changed: qtyChanged,
      operation_type: operation,
      reason: reason || 'Manual Admin Update',
      created_by: admin_id,
      created_at: new Date().toISOString(),
    };
    memoryStore.hub_inventory_movements.unshift(movement);

    const prod = memoryStore.products.find((p) => p.id === product_id);
    const hubs = getPersistedHubs();
    const hub = hubs.find((h) => h.id === hub_id);

    const inventoryItem: HubInventoryItem = {
      id: inv.id,
      hub_id,
      hub_name: hub?.name,
      product_id,
      product_name: prod?.name || 'Produce',
      unit: prod?.unit || 'unit',
      selling_price: Number(prod?.selling_price || 0),
      stock_quantity: newStock,
      reserved_quantity: 0,
      available_to_sell: newStock,
      minimum_stock: minStock,
      status: inv.status,
      updated_at: inv.updated_at,
    };

    return { inventory: inventoryItem, movement };
  }
}

/**
 * Atomically deduct hub stock for an order during order creation.
 */
export async function deductHubStockForOrder(
  client: any,
  hub_id: string,
  items: { product_id: string; variant_id?: string | null; quantity: number; name?: string }[],
  order_id: string
): Promise<void> {
  ensureMockHubInventoryInitialized();
  if (!hub_id) return; // Non-multi-hub fallback

  for (const item of items) {
    const qty = Number(item.quantity);
    if (qty <= 0) continue;

    try {
      // Row locking / atomic decrement
      const res = await client.query(
        `UPDATE hub_inventory
         SET stock_quantity = stock_quantity - $1,
             updated_at = NOW(),
             status = CASE WHEN (stock_quantity - $1) <= 0 THEN 'out_of_stock'
                           WHEN (stock_quantity - $1) <= minimum_stock THEN 'low_stock'
                           ELSE 'in_stock' END
         WHERE hub_id = $2 AND product_id = $3 AND stock_quantity >= $1
         RETURNING *`,
        [qty, hub_id, item.product_id]
      );

      if (res.rows.length === 0) {
        // Check if row existed with insufficient stock
        const check = await client.query(
          'SELECT stock_quantity FROM hub_inventory WHERE hub_id = $1 AND product_id = $2',
          [hub_id, item.product_id]
        );
        const avail = check.rows.length > 0 ? Number(check.rows[0].stock_quantity) : 0;
        throw new ValidationError(
          `${item.name || 'Product'} is out of stock or has only ${avail} available at the assigned fulfillment hub.`
        );
      }

      const row = res.rows[0];
      const prevStock = Number(row.stock_quantity) + qty;

      await client.query(
        `INSERT INTO hub_inventory_movements (
          id, hub_id, product_id, variant_id, previous_stock, new_stock,
          quantity_changed, operation_type, reason, reference_type, reference_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ORDER_DEDUCT', $8, 'order', $9, NOW())`,
        [uuidv4(), hub_id, item.product_id, item.variant_id || null, prevStock, row.stock_quantity, -qty, `Order fulfillment #${order_id}`, order_id]
      );
    } catch (err: any) {
      if (err instanceof ValidationError) throw err;

      // Memory Store fallback
      const inv = memoryStore.hub_inventory.find(
        (i) => i.hub_id === hub_id && i.product_id === item.product_id
      );
      if (inv) {
        if (inv.stock_quantity < qty) {
          throw new ValidationError(
            `${item.name || 'Product'} only has ${inv.stock_quantity} available at this hub`
          );
        }
        const prevStock = inv.stock_quantity;
        inv.stock_quantity -= qty;
        inv.status = calculateStockStatus(inv.stock_quantity, inv.minimum_stock);
        inv.updated_at = new Date().toISOString();

        memoryStore.hub_inventory_movements.unshift({
          id: uuidv4(),
          hub_id,
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          previous_stock: prevStock,
          new_stock: inv.stock_quantity,
          quantity_changed: -qty,
          operation_type: 'ORDER_DEDUCT',
          reason: `Order fulfillment #${order_id}`,
          reference_type: 'order',
          reference_id: order_id,
          created_at: new Date().toISOString(),
        });
      }
    }
  }
}

/**
 * Atomically restore stock on order cancellation (with strict duplicate protection).
 */
export async function restoreHubStockForOrder(
  client: any,
  hub_id: string,
  items: { product_id: string; variant_id?: string | null; quantity: number; name?: string }[],
  order_id: string,
  reason: string
): Promise<void> {
  ensureMockHubInventoryInitialized();
  if (!hub_id) return;

  // 1. Idempotency guard: Verify this order hasn't already been restored
  try {
    const existing = await client.query(
      "SELECT id FROM hub_inventory_movements WHERE reference_id = $1 AND operation_type = 'ORDER_CANCEL_RESTORE' LIMIT 1",
      [order_id]
    );
    if (existing.rows.length > 0) {
      console.warn(`[HubInventory] Order #${order_id} stock has already been restored. Skipping duplicate restoration.`);
      return;
    }
  } catch {
    const existingMem = memoryStore.hub_inventory_movements.find(
      (m) => m.reference_id === order_id && m.operation_type === 'ORDER_CANCEL_RESTORE'
    );
    if (existingMem) return;
  }

  // 2. Restore stock for each item
  for (const item of items) {
    const qty = Number(item.quantity);
    if (qty <= 0) continue;

    try {
      const res = await client.query(
        `UPDATE hub_inventory
         SET stock_quantity = stock_quantity + $1,
             updated_at = NOW(),
             status = CASE WHEN (stock_quantity + $1) <= 0 THEN 'out_of_stock'
                           WHEN (stock_quantity + $1) <= minimum_stock THEN 'low_stock'
                           ELSE 'in_stock' END
         WHERE hub_id = $2 AND product_id = $3
         RETURNING *`,
        [qty, hub_id, item.product_id]
      );

      if (res.rows.length > 0) {
        const row = res.rows[0];
        const prevStock = Number(row.stock_quantity) - qty;

        await client.query(
          `INSERT INTO hub_inventory_movements (
            id, hub_id, product_id, variant_id, previous_stock, new_stock,
            quantity_changed, operation_type, reason, reference_type, reference_id, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ORDER_CANCEL_RESTORE', $8, 'order', $9, NOW())`,
          [uuidv4(), hub_id, item.product_id, item.variant_id || null, prevStock, row.stock_quantity, qty, reason || `Cancelled Order #${order_id}`, order_id]
        );
      }
    } catch {
      // Memory Store fallback
      const inv = memoryStore.hub_inventory.find(
        (i) => i.hub_id === hub_id && i.product_id === item.product_id
      );
      if (inv) {
        const prevStock = inv.stock_quantity;
        inv.stock_quantity += qty;
        inv.status = calculateStockStatus(inv.stock_quantity, inv.minimum_stock);
        inv.updated_at = new Date().toISOString();

        memoryStore.hub_inventory_movements.unshift({
          id: uuidv4(),
          hub_id,
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          previous_stock: prevStock,
          new_stock: inv.stock_quantity,
          quantity_changed: qty,
          operation_type: 'ORDER_CANCEL_RESTORE',
          reason: reason || `Cancelled Order #${order_id}`,
          reference_type: 'order',
          reference_id: order_id,
          created_at: new Date().toISOString(),
        });
      }
    }
  }
}

/**
 * Fetch movements audit log.
 */
export async function getHubInventoryMovements(params: {
  hub_id?: string;
  product_id?: string;
  limit?: number;
}): Promise<HubStockMovement[]> {
  ensureMockHubInventoryInitialized();
  const limit = Math.min(100, Math.max(1, params.limit || 50));

  try {
    let whereConditions: string[] = [];
    const queryParams: any[] = [];
    let idx = 1;

    if (params.hub_id && params.hub_id !== 'all') {
      whereConditions.push(`him.hub_id = $${idx++}`);
      queryParams.push(params.hub_id);
    }
    if (params.product_id) {
      whereConditions.push(`him.product_id = $${idx++}`);
      queryParams.push(params.product_id);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const res = await db.query(
      `SELECT him.*, p.name as product_name
       FROM hub_inventory_movements him
       LEFT JOIN products p ON him.product_id = p.id
       ${whereClause}
       ORDER BY him.created_at DESC
       LIMIT $${idx}`,
      [...queryParams, limit]
    );

    return res.rows;
  } catch {
    let list = [...memoryStore.hub_inventory_movements];
    if (params.hub_id && params.hub_id !== 'all') {
      list = list.filter((m) => m.hub_id === params.hub_id);
    }
    if (params.product_id) {
      list = list.filter((m) => m.product_id === params.product_id);
    }
    return list.slice(0, limit);
  }
}

/**
 * Get active low-stock alerts per hub with deduplication.
 */
export async function getHubLowStockAlerts(hub_id?: string) {
  const inventoryResult = await getHubInventory({ hub_id, limit: 200 });
  const lowStockItems = inventoryResult.items.filter(
    (i) => i.status === 'low_stock' || i.status === 'out_of_stock'
  );

  return lowStockItems.map((item) => ({
    alert_key: `${item.hub_id}:${item.product_id}:${item.status}`,
    hub_id: item.hub_id,
    hub_name: item.hub_name,
    product_id: item.product_id,
    product_name: item.product_name,
    current_stock: item.stock_quantity,
    minimum_stock: item.minimum_stock,
    status: item.status,
    alert_severity: item.status === 'out_of_stock' ? 'CRITICAL' : 'WARNING',
    message:
      item.status === 'out_of_stock'
        ? `${item.product_name} is completely OUT OF STOCK at ${item.hub_name}!`
        : `${item.product_name} is running LOW (${item.stock_quantity} left) at ${item.hub_name} (Threshold: ${item.minimum_stock}).`,
  }));
}

